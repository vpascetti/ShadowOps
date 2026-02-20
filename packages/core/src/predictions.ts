import type { Job } from './schema.js'

export type JobSnapshot = {
  snapshot_date: Date
  hours_to_go: number
  qty_completed: number
  status: string
}

export type PredictionResult = {
  method: string
  predicted_completion_date: Date | null
  predicted_lateness_days: number
  confidence_score: number
  basis: string
}

export type AnomalyAlert = {
  type: 'slowdown' | 'queue_buildup' | 'unusual_pattern'
  work_center: string
  severity: 'low' | 'medium' | 'high'
  message: string
  metric_value: number
  historical_baseline: number
  deviation_percent: number
}

/**
 * Velocity-based forecasting
 * Predicts job completion based on recent work rate
 */
export function forecastCompletion(
  job: Job,
  snapshots: JobSnapshot[],
  options: { asOf?: Date; lookbackDays?: number } = {}
): PredictionResult {
  const asOf = options.asOf ?? new Date()
  const lookbackDays = options.lookbackDays ?? 7

  // If no remaining work, already done
  if (job.remaining_work <= 0) {
    return {
      method: 'velocity',
      predicted_completion_date: asOf,
      predicted_lateness_days: 0,
      confidence_score: 1.0,
      basis: 'Job already complete',
    }
  }

  // Filter recent snapshots
  const recentSnapshots = snapshots
    .filter(
      (s) =>
        s.snapshot_date <= asOf &&
        s.snapshot_date > new Date(asOf.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
    )
    .sort((a, b) => a.snapshot_date.getTime() - b.snapshot_date.getTime())

  // Need at least 2 snapshots for trend
  if (recentSnapshots.length < 2) {
    return {
      method: 'velocity',
      predicted_completion_date: null,
      predicted_lateness_days: 0,
      confidence_score: 0.3,
      basis: 'Insufficient historical data (need 2+ snapshots)',
    }
  }

  // Calculate velocity: hours completed per day
  const firstSnapshot = recentSnapshots[0]
  const lastSnapshot = recentSnapshots[recentSnapshots.length - 1]
  const daysBetween =
    (lastSnapshot.snapshot_date.getTime() - firstSnapshot.snapshot_date.getTime()) /
    (1000 * 60 * 60 * 24)

  if (daysBetween === 0) {
    return {
      method: 'velocity',
      predicted_completion_date: null,
      predicted_lateness_days: 0,
      confidence_score: 0.2,
      basis: 'Snapshots too close together',
    }
  }

  // Hours completed in the period
  const hoursCompleted =
    (firstSnapshot.hours_to_go ?? 0) - (lastSnapshot.hours_to_go ?? 0)
  
  if (hoursCompleted < 0.1) {
    return {
      method: 'velocity',
      predicted_completion_date: null,
      predicted_lateness_days: 0,
      confidence_score: 0.4,
      basis: 'No progress detected in recent period',
    }
  }

  const velocityPerDay = hoursCompleted / daysBetween

  if (velocityPerDay <= 0) {
    return {
      method: 'velocity',
      predicted_completion_date: null,
      predicted_lateness_days: 0,
      confidence_score: 0.4,
      basis: 'No progress detected in recent period',
    }
  }

  // Days to completion at current velocity
  const remainingWork = job.remaining_work
  const daysToCompletion = remainingWork / velocityPerDay
  const predictedCompletion = new Date(asOf.getTime() + daysToCompletion * 24 * 60 * 60 * 1000)

  // Calculate lateness vs due date
  const dueDate = new Date(job.due_date)
  const latenessMs = predictedCompletion.getTime() - dueDate.getTime()
  const lateness_days = Math.ceil(latenessMs / (1000 * 60 * 60 * 24))

  // Confidence based on snapshot consistency
  // If velocity is stable, higher confidence
  const dayVelocities: number[] = []
  for (let i = 1; i < recentSnapshots.length; i++) {
    const prev = recentSnapshots[i - 1]
    const curr = recentSnapshots[i]
    const dayDiff =
      (curr.snapshot_date.getTime() - prev.snapshot_date.getTime()) / (1000 * 60 * 60 * 24)
    const hoursWorked = (prev.hours_to_go ?? 0) - (curr.hours_to_go ?? 0)
    if (dayDiff > 0) {
      dayVelocities.push(hoursWorked / dayDiff)
    }
  }

  let confidence = 0.8
  if (dayVelocities.length > 1) {
    // Calculate coefficient of variation
    const avgVel = dayVelocities.reduce((a, b) => a + b, 0) / dayVelocities.length
    const variance =
      dayVelocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / dayVelocities.length
    const stdDev = Math.sqrt(variance)
    const cv = avgVel > 0 ? stdDev / avgVel : 1
    // Less than 0.2 CV = consistent, lower CV = higher confidence
    confidence = Math.max(0.5, 1 - Math.min(cv, 1))
  }

  return {
    method: 'velocity',
    predicted_completion_date: predictedCompletion,
    predicted_lateness_days: Math.max(lateness_days, 0),
    confidence_score: confidence,
    basis: `Velocity: ${velocityPerDay.toFixed(1)} hrs/day over ${daysBetween.toFixed(1)} days`,
  }
}

/**
 * Detect anomalies in work center performance
 */
export function detectAnomalies(
  workCenter: string,
  metrics: {
    metric_date: Date
    throughput?: number
    avg_cycle_time?: number
    queue_depth?: number
    utilization?: number
    scrap_rate?: number
  }[],
  options: { lookbackDays?: number; stdDevThreshold?: number } = {}
): AnomalyAlert[] {
  const lookbackDays = options.lookbackDays ?? 30
  const stdDevThreshold = options.stdDevThreshold ?? 2 // 2 stddev = ~95% confidence

  // Filter to recent metrics
  const now = new Date()
  const recentMetrics = metrics
    .filter((m) => m.metric_date > new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000))
    .sort((a, b) => a.metric_date.getTime() - b.metric_date.getTime())

  const alerts: AnomalyAlert[] = []

  // Check throughput for slowdown
  if (recentMetrics.length >= 3) {
    const throughputs = recentMetrics
      .map((m) => m.throughput ?? 0)
      .filter((t) => typeof t === 'number' && t > 0)
    
    if (throughputs.length >= 3) {
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length
      const variance =
        throughputs.reduce((sum, t) => sum + Math.pow(t - avgThroughput, 2), 0) /
        throughputs.length
      const stdDev = Math.sqrt(variance)
      const latestThroughput = throughputs[throughputs.length - 1]

      if (latestThroughput < avgThroughput - stdDevThreshold * stdDev && stdDev > 0) {
        const devPercent = ((avgThroughput - latestThroughput) / avgThroughput) * 100
        alerts.push({
          type: 'slowdown',
          work_center: workCenter,
          severity: devPercent > 30 ? 'high' : 'medium',
          message: `Work center ${workCenter} throughput is ${devPercent.toFixed(1)}% below historical average`,
          metric_value: latestThroughput,
          historical_baseline: avgThroughput,
          deviation_percent: devPercent,
        })
      }
    }
  }

  // Check queue depth for buildup
  if (recentMetrics.length >= 3) {
    const depths = recentMetrics
      .map((m) => m.queue_depth ?? 0)
      .filter((d) => typeof d === 'number')
    
    if (depths.length >= 3) {
      const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length
      const variance = depths.reduce((sum, d) => sum + Math.pow(d - avgDepth, 2), 0) / depths.length
      const stdDev = Math.sqrt(variance)
      const latestDepth = depths[depths.length - 1]

      // Trend detection: is queue trending upward?
      const recentTrend = depths.slice(-5)
      const isIncreasing = recentTrend.every((d, i) => i === 0 || d >= recentTrend[i - 1])

      if (latestDepth > avgDepth + stdDevThreshold * stdDev && stdDev > 0 && isIncreasing) {
        const devPercent = ((latestDepth - avgDepth) / Math.max(avgDepth, 1)) * 100
        alerts.push({
          type: 'queue_buildup',
          work_center: workCenter,
          severity: devPercent > 50 ? 'high' : 'medium',
          message: `Queue building on ${workCenter}: ${latestDepth} jobs (normally ${avgDepth.toFixed(0)})`,
          metric_value: latestDepth,
          historical_baseline: avgDepth,
          deviation_percent: devPercent,
        })
      }
    }
  }

  // Check scrap rate for elevated defects
  if (recentMetrics.length >= 3) {
    const scrapRates = recentMetrics
      .map((m) => m.scrap_rate ?? 0)
      .filter((s) => typeof s === 'number')
    
    if (scrapRates.length >= 3) {
      const avgScrap = scrapRates.reduce((a, b) => a + b, 0) / scrapRates.length
      const variance =
        scrapRates.reduce((sum, s) => sum + Math.pow(s - avgScrap, 2), 0) / scrapRates.length
      const stdDev = Math.sqrt(variance)
      const latestScrap = scrapRates[scrapRates.length - 1]

      if (latestScrap > avgScrap + stdDevThreshold * stdDev && stdDev > 0) {
        const devPercent = ((latestScrap - avgScrap) / Math.max(avgScrap, 0.001)) * 100
        alerts.push({
          type: 'unusual_pattern',
          work_center: workCenter,
          severity: latestScrap > 0.1 ? 'high' : 'medium',
          message: `Elevated scrap rate on ${workCenter}: ${(latestScrap * 100).toFixed(1)}%`,
          metric_value: latestScrap,
          historical_baseline: avgScrap,
          deviation_percent: devPercent,
        })
      }
    }
  }

  return alerts
}

/**
 * Compare two snapshots to detect immediate anomalies
 */
export function detectImmediateIssues(
  job: Job,
  latestSnapshot: JobSnapshot | null,
  previousSnapshot: JobSnapshot | null
): { issue: string; severity: 'warning' | 'critical' }[] {
  const issues: { issue: string; severity: 'warning' | 'critical' }[] = []

  // No progress since last snapshot
  if (latestSnapshot && previousSnapshot) {
    const hoursCompleted =
      (previousSnapshot.hours_to_go ?? 0) - (latestSnapshot.hours_to_go ?? 0)
    const daysBetween =
      (latestSnapshot.snapshot_date.getTime() - previousSnapshot.snapshot_date.getTime()) /
      (1000 * 60 * 60 * 24)

    if (daysBetween >= 1 && hoursCompleted < 0.5) {
      issues.push({
        issue: `No progress on job ${job.job_id} in ${daysBetween.toFixed(1)} days - stalled?`,
        severity: 'critical',
      })
    }
  }

  // Job already late
  if (job.status === 'Late' || job.status === 'LATE') {
    issues.push({
      issue: `Job ${job.job_id} is LATE - due ${job.due_date}`,
      severity: 'critical',
    })
  }

  // Expiring soon with significant work remaining
  const daysUntilDue =
    (new Date(job.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  if (daysUntilDue > 0 && daysUntilDue <= 3 && job.remaining_work > 10) {
    issues.push({
      issue: `Job ${job.job_id} due in ${daysUntilDue.toFixed(1)} days with ${job.remaining_work} hours remaining`,
      severity: 'critical',
    })
  }

  return issues
}
