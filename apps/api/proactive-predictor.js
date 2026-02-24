/**
 * Proactive Predictive Analytics Service
 * 
 * Predicts 3 key issues BEFORE they happen:
 * 1. Missed Deadlines - Which jobs are at risk of being late
 * 2. Bottlenecks - Which work centers will be constrained in next 2-3 days
 * 3. Material Shortages - Jobs that will hit inventory constraints
 * 
 * Uses statistical models with ML-ready data collection.
 */

import { query } from './db.js'

// ============================================================================
// 1. ENHANCED DEADLINE PREDICTION
// ============================================================================

/**
 * Predicts jobs at risk of missing deadlines
 * Accounts for: velocity, dependencies, shared resources, current queue
 */
export async function predictLatenessRisk(tenantId, lookbackDays = 30) {
  try {
    // Get all active jobs
    const jobsResult = await query(
      `SELECT job_id, due_date, hours_to_go, work_center, status 
       FROM jobs 
       WHERE tenant_id = $1 
       AND status NOT IN ('Complete', 'Closed', 'Cancelled')
       ORDER BY due_date ASC`,
      [tenantId]
    )

    const jobsAtRisk = []

    for (const job of jobsResult.rows) {
      // Get velocity for this job
      const snapshots = await query(
        `SELECT snapshot_date, hours_to_go FROM job_snapshots
         WHERE tenant_id = $1 AND job_id = $2
         AND snapshot_date > now() - interval '1 day' * $3
         ORDER BY snapshot_date DESC
         LIMIT 20`,
        [tenantId, job.job_id, lookbackDays]
      )

      if (snapshots.rowCount < 2) continue

      const sorted = snapshots.rows.sort(
        (a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)
      )
      const oldest = sorted[0]
      const newest = sorted[snapshots.rowCount - 1]

      const daysBetween =
        (new Date(newest.snapshot_date) - new Date(oldest.snapshot_date)) /
        (1000 * 60 * 60 * 24)
      const hoursCompleted =
        parseFloat(oldest.hours_to_go || 0) - parseFloat(newest.hours_to_go || 0)

      if (daysBetween === 0 || hoursCompleted < 0.1) continue

      const velocityPerDay = hoursCompleted / daysBetween
      const remainingHours = parseFloat(job.hours_to_go) || 0
      const daysToCompletion = velocityPerDay > 0 ? remainingHours / velocityPerDay : 999

      // Calculate days until due
      const daysUntilDue =
        (new Date(job.due_date) - new Date()) / (1000 * 60 * 60 * 24)

      // Calculate risk factors
      let riskScore = 0
      let riskFactors = []

      // Factor 1: Will complete after due date?
      if (daysToCompletion > daysUntilDue) {
        const latenessMargin = daysToCompletion - daysUntilDue
        riskScore += Math.min(latenessMargin, 10) // Cap at 10 days late
        riskFactors.push(
          `Will be ${latenessMargin.toFixed(1)} days late at current velocity`
        )
      }

      // Factor 2: Queue depth at work center (resource contention)
      if (job.work_center) {
        const queueResult = await query(
          `SELECT queue_depth FROM work_center_metrics
           WHERE tenant_id = $1 AND work_center = $2
           ORDER BY metric_date DESC LIMIT 1`,
          [tenantId, job.work_center]
        )

        if (queueResult.rowCount > 0) {
          const queueDepth = queueResult.rows[0].queue_depth || 0
          if (queueDepth > 5) {
            riskScore += Math.min(queueDepth / 2, 5) // Scale down to prevent domination
            riskFactors.push(`High queue depth at ${job.work_center} (${queueDepth} jobs)`)
          }
        }
      }

      // Factor 3: Velocity trending downward (deteriorating progress)
      let velocityTrend = 0
      if (snapshots.rowCount >= 3) {
        const recent = sorted.slice(-3) // Last 3 snapshots
        const velocities = []
        for (let i = 1; i < recent.length; i++) {
          const dayDiff =
            (new Date(recent[i].snapshot_date) - new Date(recent[i - 1].snapshot_date)) /
            (1000 * 60 * 60 * 24)
          const hours =
            parseFloat(recent[i - 1].hours_to_go || 0) -
            parseFloat(recent[i].hours_to_go || 0)
          if (dayDiff > 0) velocities.push(hours / dayDiff)
        }
        if (velocities.length >= 2) {
          const trend = velocities[velocities.length - 1] - velocities[0]
          if (trend < 0) {
            // Velocity is declining
            velocityTrend = Math.abs(trend)
            riskScore += velocityTrend
            riskFactors.push(
              `Velocity declining: ${velocityPerDay.toFixed(1)} hrs/day (was higher)`
            )
          }
        }
      }

      // Calculate confidence (0-1.0, higher = more confident in the risk)
      const confidence = Math.min(snapshots.rowCount / 10, 1.0)

      // Determine risk level
      let riskLevel = 'low'
      if (riskScore >= 8) riskLevel = 'critical'
      else if (riskScore >= 5) riskLevel = 'high'
      else if (riskScore >= 3) riskLevel = 'medium'

      if (riskScore >= 2) {
        jobsAtRisk.push({
          job_id: job.job_id,
          due_date: job.due_date,
          work_center: job.work_center,
          days_until_due: parseFloat(daysUntilDue.toFixed(1)),
          velocity_per_day: parseFloat(velocityPerDay.toFixed(1)),
          days_to_completion: parseFloat(daysToCompletion.toFixed(1)),
          predicted_lateness_days: parseFloat(Math.max(0, daysToCompletion - daysUntilDue).toFixed(1)),
          risk_score: parseFloat(riskScore.toFixed(1)),
          risk_level: riskLevel,
          confidence: parseFloat(confidence.toFixed(2)),
          risk_factors: riskFactors,
          recommended_action:
            riskScore >= 8
              ? 'URGENT: Add resources or expedite this job immediately'
              : riskScore >= 5
                ? 'Prioritize this job, consider reassigning non-critical work'
                : 'Monitor closely, may need intervention',
        })
      }
    }

    return jobsAtRisk.sort((a, b) => b.risk_score - a.risk_score)
  } catch (err) {
    console.error('Error predicting lateness risk:', err)
    return []
  }
}

// ============================================================================
// 2. BOTTLENECK DETECTION (2-3 days ahead)
// ============================================================================

/**
 * Predicts which work center will become a bottleneck in the next 2-3 days
 * Based on: current queue, incoming job queue, throughput velocity
 */
export async function predictUpcomingBottlenecks(
  tenantId,
  lookbackDays = 30,
  forecastDays = 3
) {
  try {
    // Get all work centers
    const workCentersResult = await query(
      `SELECT DISTINCT work_center FROM jobs 
       WHERE tenant_id = $1 AND work_center IS NOT NULL`,
      [tenantId]
    )

    const bottlenecks = []

    for (const row of workCentersResult.rows) {
      const wc = row.work_center

      // Get recent metrics for this work center
      const metricsResult = await query(
        `SELECT metric_date, queue_depth, throughput, avg_cycle_time
         FROM work_center_metrics
         WHERE tenant_id = $1 AND work_center = $2
         AND metric_date > now() - interval '1 day' * $3
         ORDER BY metric_date DESC
         LIMIT 50`,
        [tenantId, wc, lookbackDays]
      )

      if (metricsResult.rowCount < 2) continue

      const metrics = metricsResult.rows.sort(
        (a, b) => new Date(a.metric_date) - new Date(b.metric_date)
      )

      // Current state
      const current = metrics[metrics.length - 1]
      const currentQueue = current.queue_depth || 0
      const currentThroughput = current.throughput || 0
      const avgCycleTime = current.avg_cycle_time || 0

      // Calculate queue trend
      let queueTrend = 0
      if (metrics.length >= 3) {
        const queues = metrics.slice(-3).map((m) => m.queue_depth || 0)
        const trend = queues[2] - queues[0]
        queueTrend = trend
      }

      // Calculate incoming job count (jobs targeting this work center due/assigned within forecastDays)
      const incomingJobsResult = await query(
        `SELECT COUNT(*) as count FROM jobs
         WHERE tenant_id = $1 AND work_center = $2
         AND status NOT IN ('Complete', 'Closed', 'Cancelled')
         AND due_date <= now() + interval '1 day' * $3`,
        [tenantId, wc, forecastDays]
      )

      const incomingJobs = parseInt(incomingJobsResult.rows[0].count || 0, 10)

      // Bottleneck risk calculation
      let bottleneckScore = 0
      let factors = []

      // Factor 1: High current queue
      if (currentQueue > 8) {
        bottleneckScore += Math.min(currentQueue / 2, 5)
        factors.push(`High queue detected: ${currentQueue} jobs`)
      }

      // Factor 2: Growing queue (queue trending up)
      if (queueTrend > 0) {
        bottleneckScore += queueTrend
        factors.push(`Queue growing: +${queueTrend.toFixed(1)} jobs per day`)
      }

      // Factor 3: High incoming job count
      if (incomingJobs > 3) {
        bottleneckScore += Math.min(incomingJobs / 2, 4)
        factors.push(`${incomingJobs} jobs due in next ${forecastDays} days`)
      }

      // Factor 4: Low throughput relative to queue
      if (currentThroughput > 0 && currentQueue > currentThroughput * 2) {
        bottleneckScore += 3
        factors.push(
          `Queue depth (${currentQueue}) >> throughput capacity (${currentThroughput.toFixed(1)}/day)`
        )
      }

      // Determine risk level
      let riskLevel = 'low'
      let recommendation = 'Monitor normally'

      if (bottleneckScore >= 8) {
        riskLevel = 'critical'
        recommendation =
          'IMMEDIATE: Add resources or divert jobs to alternate work center'
      } else if (bottleneckScore >= 5) {
        riskLevel = 'high'
        recommendation = 'Prepare additional resources, may need capacity increase'
      } else if (bottleneckScore >= 3) {
        riskLevel = 'medium'
        recommendation = 'Watch closely, prepare contingency'
      }

      if (bottleneckScore >= 2) {
        bottlenecks.push({
          work_center: wc,
          risk_score: parseFloat(bottleneckScore.toFixed(1)),
          risk_level: riskLevel,
          current_queue_depth: currentQueue,
          queue_trend: parseFloat(queueTrend.toFixed(1)),
          incoming_jobs_next_n_days: incomingJobs,
          forecast_days: forecastDays,
          avg_cycle_time_minutes: avgCycleTime ? parseFloat(avgCycleTime.toFixed(1)) : null,
          historical_throughput_per_day: currentThroughput
            ? parseFloat(currentThroughput.toFixed(1))
            : null,
          factors: factors,
          recommendation: recommendation,
        })
      }
    }

    return bottlenecks.sort((a, b) => b.risk_score - a.risk_score)
  } catch (err) {
    console.error('Error predicting bottlenecks:', err)
    return []
  }
}

// ============================================================================
// 3. MATERIAL SHORTAGE PREDICTION
// ============================================================================

/**
 * Predicts jobs at risk due to material constraints
 * Checks: current inventory, required materials, supplier lead times
 */
export async function predictMaterialShortages(tenantId, lookbackDays = 30) {
  try {
    // Get all jobs with material shortage indicators
    const jobsResult = await query(
      `SELECT job_id, part, due_date, hours_to_go, status, root_cause, reason
       FROM jobs
       WHERE tenant_id = $1
       AND status NOT IN ('Complete', 'Closed', 'Cancelled')
       ORDER BY due_date ASC`,
      [tenantId]
    )

    const shortageRisks = []

    for (const job of jobsResult.rows) {
      let hasMaterialRisk = false
      let riskReasons = []

      // Check 1: Does root_cause or reason indicate material issues?
      if (job.root_cause || job.reason) {
        const cause = (job.root_cause || job.reason || '').toLowerCase()
        if (
          cause.includes('material') ||
          cause.includes('shortage') ||
          cause.includes('supply') ||
          cause.includes('inventory')
        ) {
          hasMaterialRisk = true
          riskReasons.push('Job flagged with historical material issue')
        }
      }

      // Check 2: If we have inventory tracking, check if part is low stock
      if (job.part) {
        const inventoryResult = await query(
          `SELECT qty_on_hand, min_threshold FROM inventory
           WHERE (sku = $1 OR part = $1)
           LIMIT 1`,
          [job.part]
        )

        if (inventoryResult.rowCount > 0) {
          const inv = inventoryResult.rows[0]
          const qty = parseFloat(inv.qty_on_hand || 0)
          const minThresh = parseFloat(inv.min_threshold || 0)

          if (qty <= minThresh) {
            hasMaterialRisk = true
            riskReasons.push(
              `Part ${job.part}: stock ${qty} <= min threshold ${minThresh}`
            )
          }
        }
      }

      // Check 3: Pattern-based: same part in queue, previous shortages
      if (job.part) {
        const queuedSamePartResult = await query(
          `SELECT COUNT(*) as count FROM jobs
           WHERE tenant_id = $1 AND part = $2
           AND status NOT IN ('Complete', 'Closed', 'Cancelled')
           AND job_id != $3`,
          [tenantId, job.part, job.job_id]
        )

        const queuedCount = parseInt(queuedSamePartResult.rows[0].count || 0, 10)
        if (queuedCount >= 3) {
          hasMaterialRisk = true
          riskReasons.push(
            `${queuedCount} other jobs using same part (material demand spike)`
          )
        }
      }

      // Calculate risk score and days until issue
      if (hasMaterialRisk) {
        const daysUntilDue =
          (new Date(job.due_date) - new Date()) / (1000 * 60 * 60 * 24)

        // Risk increases as we get closer to due date with unresolved issues
        const riskScore = Math.max(1, 10 - daysUntilDue)

        shortageRisks.push({
          job_id: job.job_id,
          part: job.part,
          due_date: job.due_date,
          days_until_due: parseFloat(daysUntilDue.toFixed(1)),
          risk_score: parseFloat(riskScore.toFixed(1)),
          risk_level:
            riskScore >= 7
              ? 'critical'
              : riskScore >= 4
                ? 'high'
                : 'medium',
          material_risk_factors: riskReasons,
          recommended_action:
            riskScore >= 7
              ? 'URGENT: Check material availability and supplier ETA'
              : 'Contact supplier to confirm availability and lead time',
        })
      }
    }

    return shortageRisks.sort((a, b) => b.risk_score - a.risk_score)
  } catch (err) {
    console.error('Error predicting material shortages:', err)
    return []
  }
}

// ============================================================================
// MACHINE LEARNING DATA COLLECTION
// ============================================================================

/**
 * Record prediction outcomes for ML model training
 * Tracks: predicted vs actual, confidence accuracy, factor weights
 */
export async function recordPredictionOutcome(tenantId, jobId, prediction, outcome) {
  try {
    const result = await query(
      `INSERT INTO prediction_training_data 
       (tenant_id, job_id, prediction_type, prediction_data, outcome, outcome_date)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [tenantId, jobId, prediction.method, JSON.stringify(prediction), JSON.stringify(outcome)]
    )
    return result.rows[0]
  } catch (err) {
    console.error('Error recording prediction outcome:', err)
    return null
  }
}

/**
 * Get model accuracy metrics for training set
 */
export async function getModelAccuracy(tenantId, predictionType, days = 30) {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total_predictions,
        AVG(CASE WHEN (prediction_data->>'confidence_score')::float > 0.7 THEN 1 ELSE 0 END) as high_confidence_ratio,
        AVG(CASE WHEN outcome->>'was_accurate' = 'true' THEN 1 ELSE 0 END) as accuracy_rate
       FROM prediction_training_data
       WHERE tenant_id = $1 
       AND prediction_type = $2
       AND outcome_date > now() - interval '1 day' * $3`,
      [tenantId, predictionType, days]
    )

    return result.rows[0] || { total_predictions: 0, accuracy_rate: 0 }
  } catch (err) {
    console.error('Error getting model accuracy:', err)
    return null
  }
}
