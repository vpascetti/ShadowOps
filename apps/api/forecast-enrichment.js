/**
 * Forecast Enrichment Service
 * 
 * Calculates predictions for individual jobs and work centers
 * to enrich API responses with forward-looking intelligence.
 */

import { query } from './db.js'

/**
 * Get forecast for a specific job
 */
export async function getJobForecast(tenantId, jobId, lookbackDays = 7) {
  try {
    // Get current job data
    const jobResult = await query(
      `SELECT job_id, due_date, hours_to_go, status FROM jobs WHERE tenant_id = $1 AND job_id = $2 LIMIT 1`,
      [tenantId, jobId]
    )

    if (jobResult.rowCount === 0) return null

    const job = jobResult.rows[0]

    // Get recent snapshots for velocity calculation
    const snapshotsResult = await query(
      `SELECT snapshot_date, hours_to_go FROM job_snapshots 
       WHERE tenant_id = $1 AND job_id = $2 
       AND snapshot_date > now() - interval '1 day' * $3
       ORDER BY snapshot_date DESC 
       LIMIT 30`,
      [tenantId, jobId, lookbackDays]
    )

    if (snapshotsResult.rowCount < 2) {
      return {
        method: 'velocity',
        predicted_completion_date: null,
        predicted_lateness_days: 0,
        confidence_score: 0.3,
        basis: 'Insufficient historical data (need 2+ snapshots)',
      }
    }

    const snapshots = snapshotsResult.rows.sort(
      (a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)
    )

    // Calculate velocity
    const oldest = snapshots[0]
    const newest = snapshots[snapshots.length - 1]
    const daysBetween =
      (new Date(newest.snapshot_date) - new Date(oldest.snapshot_date)) /
      (1000 * 60 * 60 * 24)
    const hoursCompleted =
      parseFloat(oldest.hours_to_go || 0) - parseFloat(newest.hours_to_go || 0)

    if (daysBetween === 0 || hoursCompleted < 0.1) {
      return {
        method: 'velocity',
        predicted_completion_date: null,
        predicted_lateness_days: 0,
        confidence_score: 0.4,
        basis: 'No progress detected in recent period',
      }
    }

    const velocityPerDay = hoursCompleted / daysBetween
    const remainingWork = parseFloat(job.hours_to_go) || 0
    const daysToCompletion = remainingWork / velocityPerDay
    const predictedCompletion = new Date(Date.now() + daysToCompletion * 24 * 60 * 60 * 1000)

    // Calculate lateness vs due date
    const dueDate = new Date(job.due_date)
    const latenessMs = predictedCompletion - dueDate
    const latenessDays = Math.ceil(latenessMs / (1000 * 60 * 60 * 24))

    // Calculate confidence based on velocity variance
    const dayVelocities = []
    for (let i = 1; i < snapshots.length; i++) {
      const dayDiff =
        (new Date(snapshots[i].snapshot_date) - new Date(snapshots[i - 1].snapshot_date)) /
        (1000 * 60 * 60 * 24)
      const hoursWorked =
        parseFloat(snapshots[i - 1].hours_to_go || 0) - parseFloat(snapshots[i].hours_to_go || 0)
      if (dayDiff > 0) dayVelocities.push(hoursWorked / dayDiff)
    }

    let confidence = 0.8
    if (dayVelocities.length > 1) {
      const avgVel = dayVelocities.reduce((a, b) => a + b, 0) / dayVelocities.length
      const variance =
        dayVelocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) /
        dayVelocities.length
      const stdDev = Math.sqrt(variance)
      const cv = avgVel > 0 ? stdDev / avgVel : 1
      confidence = Math.max(0.5, 1 - Math.min(cv, 1))
    }

    return {
      method: 'velocity',
      predicted_completion_date: predictedCompletion.toISOString(),
      predicted_lateness_days: Math.max(latenessDays, 0),
      confidence_score: parseFloat(confidence.toFixed(2)),
      basis: `Velocity: ${velocityPerDay.toFixed(1)} hrs/day over ${daysBetween.toFixed(1)} days`,
    }
  } catch (err) {
    console.error(`Error calculating forecast for job ${jobId}:`, err)
    return null
  }
}

/**
 * Detect issues with a specific job (stalled, expiring soon, etc)
 */
export async function getJobIssues(tenantId, jobId) {
  try {
    const jobResult = await query(
      `SELECT job_id, due_date, hours_to_go, status FROM jobs WHERE tenant_id = $1 AND job_id = $2 LIMIT 1`,
      [tenantId, jobId]
    )

    if (jobResult.rowCount === 0) return []

    const job = jobResult.rows[0]
    const issues = []

    // Check if late
    if (job.status === 'Late' || job.status === 'LATE') {
      issues.push({
        type: 'critical',
        message: `Job is LATE - due ${new Date(job.due_date).toLocaleDateString()}`,
        icon: '🔴',
      })
    }

    // Check if expiring soon
    const daysUntilDue =
      (new Date(job.due_date) - new Date()) / (1000 * 60 * 60 * 24)
    if (daysUntilDue > 0 && daysUntilDue <= 3 && parseFloat(job.hours_to_go) > 10) {
      issues.push({
        type: 'urgent',
        message: `Due in ${daysUntilDue.toFixed(1)} days with ${parseFloat(job.hours_to_go).toFixed(0)} hours work remaining`,
        icon: '⚠️',
      })
    }

    // Check if stalled (no progress in recent period)
    const snapshotsResult = await query(
      `SELECT snapshot_date, hours_to_go FROM job_snapshots 
       WHERE tenant_id = $1 AND job_id = $2 
       AND snapshot_date > now() - interval '2 days'
       ORDER BY snapshot_date DESC 
       LIMIT 2`,
      [tenantId, jobId]
    )

    if (snapshotsResult.rowCount >= 2) {
      const latest = snapshotsResult.rows[0]
      const previous = snapshotsResult.rows[1]
      const hoursCompleted =
        parseFloat(previous.hours_to_go || 0) - parseFloat(latest.hours_to_go || 0)
      const daysBetween =
        (new Date(latest.snapshot_date) - new Date(previous.snapshot_date)) /
        (1000 * 60 * 60 * 24)

      if (daysBetween >= 1 && hoursCompleted < 0.5) {
        issues.push({
          type: 'warning',
          message: `No progress in ${daysBetween.toFixed(1)} days - may be stalled`,
          icon: '⏸️',
        })
      }
    }

    return issues
  } catch (err) {
    console.error(`Error getting issues for job ${jobId}:`, err)
    return []
  }
}

/**
 * Get anomalies for a work center (or all work centers)
 */
export async function getWorkCenterAnomalies(tenantId, workCenter, lookbackDays = 30) {
  try {
    // Special case: if workCenter is 'ALL', get anomalies for all work centers
    if (workCenter === 'ALL') {
      const wcResult = await query(
        `SELECT DISTINCT work_center FROM jobs WHERE tenant_id = $1 AND work_center IS NOT NULL`,
        [tenantId]
      )
      
      const allAnomalies = {}
      for (const row of wcResult.rows) {
        const alerts = await getWorkCenterAnomalies(tenantId, row.work_center, lookbackDays)
        if (alerts.length > 0) {
          allAnomalies[row.work_center] = alerts
        }
      }
      return allAnomalies
    }
    
    const metricsResult = await query(
      `SELECT metric_date, throughput, queue_depth, scrap_rate 
       FROM work_center_metrics 
       WHERE tenant_id = $1 AND work_center = $2 
       AND metric_date > now() - interval '1 day' * $3
       ORDER BY metric_date DESC
       LIMIT 100`,
      [tenantId, workCenter, lookbackDays]
    )

    if (metricsResult.rowCount < 3) return []

    const metrics = metricsResult.rows
    const alerts = []

    // Check queue depth for buildup
    const depths = metrics.map((m) => m.queue_depth || 0)
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length
    const latestDepth = depths[0]

    if (latestDepth > avgDepth * 1.5 && latestDepth > 5) {
      const trending = depths.slice(0, 3).every((d, i) => i === 0 || d >= depths[i - 1])
      if (trending) {
        alerts.push({
          type: 'queue_buildup',
          severity: 'medium',
          message: `Queue building: ${latestDepth} jobs (normally ${avgDepth.toFixed(0)})`,
          icon: '📊',
        })
      }
    }

    // Check throughput for slowdown
    const throughputs = metrics.map((m) => m.throughput || 0)
    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length
    const latestThroughput = throughputs[0]

    if (avgThroughput > 0 && latestThroughput < avgThroughput * 0.6) {
      alerts.push({
        type: 'slowdown',
        severity: 'high',
        message: `Throughput down ${((1 - latestThroughput / avgThroughput) * 100).toFixed(0)}% - check maintenance`,
        icon: '🔧',
      })
    }

    return alerts
  } catch (err) {
    console.error(`Error getting anomalies for ${workCenter}:`, err)
    return []
  }
}

/**
 * Enrich job data with forecast and issues
 */
export async function enrichJobWithPredictions(job, tenantId) {
  const [forecast, issues] = await Promise.all([
    getJobForecast(tenantId, job.job_id),
    getJobIssues(tenantId, job.job_id),
  ])

  return {
    ...job,
    forecast,
    issues: issues.length > 0 ? issues : null,
    _risk_level: issues.some((i) => i.type === 'critical')
      ? 'critical'
      : issues.some((i) => i.type === 'urgent')
        ? 'urgent'
        : issues.length > 0
          ? 'warning'
          : 'normal',
  }
}
