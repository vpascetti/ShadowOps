/**
 * CENTRALIZED METRICS CALCULATIONS
 * 
 * This is the SINGLE SOURCE OF TRUTH for all metric calculations in ShadowOps.
 * All components MUST import and use these functions - DO NOT duplicate calculation logic.
 * 
 * Reference: /METRICS_DEFINITION.md
 */

/**
 * Parse date string to Date object, normalized to midnight
 * Handles ISO format dates from IQMS
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN)
  
  try {
    let d
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        const [year, month, day] = parts
        d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0)
      } else {
        d = new Date(dateStr)
      }
    } else {
      d = new Date(dateStr)
    }
    
    d.setHours(0, 0, 0, 0)
    return d
  } catch (_e) {
    return new Date(NaN)
  }
}

/**
 * Calculate job progress ratio
 * @returns {number|null} Progress as decimal (0-1), or null if indeterminate
 */
export function calculateProgress(qtyReleased, qtyCompleted) {
  const released = parseFloat(qtyReleased)
  const completed = parseFloat(qtyCompleted)
  if (!released || released === 0 || isNaN(completed)) {
    return null
  }
  return Math.min(completed / released, 1)
}

/**
 * Calculate schedule ratio (time elapsed vs. total time)
 * @returns {number|null} Schedule ratio as decimal (0-1), or null if indeterminate
 */
export function calculateScheduleRatio(startDateStr, dueDateStr, asOfDate = new Date()) {
  try {
    const startDate = parseDate(startDateStr)
    const dueDate = parseDate(dueDateStr)
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
      return null
    }
    const totalDuration = dueDate.getTime() - startDate.getTime()
    const elapsed = asOfDate.getTime() - startDate.getTime()
    if (totalDuration <= 0) {
      return null
    }
    return elapsed / totalDuration
  } catch (_e) {
    return null
  }
}

/**
 * CRITICAL: Determine job status - SINGLE SOURCE OF TRUTH
 * 
 * Every job has EXACTLY ONE status: Late, At Risk, or On Track
 */
export function determineStatus(dueDateStr, progress, scheduleRatio, asOfDate = new Date()) {
  try {
    if (!dueDateStr) return 'On Track'
    
    // NORMALIZE TO MIDNIGHT for accurate date comparison
    const dueDate = parseDate(dueDateStr)
    if (isNaN(dueDate.getTime())) return 'On Track'
    
    const asOfDateNormalized = new Date(asOfDate)
    asOfDateNormalized.setHours(0, 0, 0, 0)
    
    // LATE: Past due date
    if (asOfDateNormalized.getTime() > dueDate.getTime()) {
      return 'Late'
    }
    
    // AT RISK: Schedule gap > 25%
    if (progress !== null && scheduleRatio !== null) {
      if (scheduleRatio - progress > 0.25) {
        return 'At Risk'
      }
    }
    
    return 'On Track'
  } catch (_e) {
    return 'On Track'
  }
}

/**
 * CRITICAL: Calculate job order value - SINGLE SOURCE OF TRUTH
 * 
 * Priority:
 * 1. Use total_order_value from database (most accurate)
 * 2. Calculate from unit_price × qty_released
 * 3. Return 0 if neither available
 */
export function getJobOrderValue(job) {
  if (!job) return 0
  
  // Priority 1: Direct total_order_value (from IQMS)
  const direct = Number(job.total_order_value || job.TotalOrderValue || job.totalOrderValue)
  if (Number.isFinite(direct) && direct > 0) return direct

  // Priority 2: Calculate from unit_price × quantity
  const unitPrice = Number(job.unit_price || job.UnitPrice || job.unitPrice)
  const qty = Number(job.QtyReleased || job.qty_released || job.mfg_quantity || 0)
  if (Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(qty) && qty > 0) {
    return unitPrice * qty
  }

  // Priority 3: No data available
  return 0
}

/**
 * Calculate all job statuses and return classification counts
 */
export function calculateMetrics(jobs) {
  const total = jobs.length
  const late = jobs.filter((j) => j.status === 'Late').length
  const atRisk = jobs.filter((j) => j.status === 'At Risk').length
  const onTrack = jobs.filter((j) => j.status === 'On Track').length

  return { total, late, atRisk, onTrack }
}

/**
 * Calculate revenue by status
 * Used for Executive Briefing metrics
 */
export function calculateRevenueByStatus(jobs) {
  const totals = {
    late: 0,
    atRisk: 0,
    onTrack: 0,
    total: 0,
    debug_late_count: 0,
    debug_at_risk_count: 0,
    debug_on_track_count: 0
  }
  
  jobs.forEach(job => {
    const value = getJobOrderValue(job)
    totals.total += value
    
    if (job.status === 'Late') {
      totals.late += value
      totals.debug_late_count++
    } else if (job.status === 'At Risk') {
      totals.atRisk += value
      totals.debug_at_risk_count++
    } else if (job.status === 'On Track') {
      totals.onTrack += value
      totals.debug_on_track_count++
    }
  })
  
  return totals
}

/**
 * Get job plant/facility
 * Used for grouping and filtering
 */
export function getJobPlant(job) {
  return (
    job.Plant ||
    job.eplant_company ||
    job.plant_name ||
    job.eplant_id ||
    job.plant_id ||
    'Unassigned'
  )
}

/**
 * Calculate plant summary with revenue breakdown
 */
export function derivePlantSummary(jobs) {
  const summaryByPlant = {}

  jobs.forEach((job) => {
    const plant = getJobPlant(job)
    if (!summaryByPlant[plant]) {
      summaryByPlant[plant] = {
        plant,
        totalJobs: 0,
        lateJobs: 0,
        atRiskJobs: 0,
        onTrackJobs: 0,
        lateRevenue: 0,
        atRiskRevenue: 0,
        onTrackRevenue: 0
      }
    }

    const entry = summaryByPlant[plant]
    entry.totalJobs += 1
    
    const orderValue = getJobOrderValue(job)
    
    if (job.status === 'Late') {
      entry.lateJobs += 1
      entry.lateRevenue += orderValue
    } else if (job.status === 'At Risk') {
      entry.atRiskJobs += 1
      entry.atRiskRevenue += orderValue
    } else if (job.status === 'On Track') {
      entry.onTrackJobs += 1
      entry.onTrackRevenue += orderValue
    }
  })

  return Object.values(summaryByPlant).sort((a, b) => {
    if (b.lateJobs !== a.lateJobs) return b.lateJobs - a.lateJobs
    if (b.atRiskJobs !== a.atRiskJobs) return b.atRiskJobs - a.atRiskJobs
    return b.lateRevenue - a.lateRevenue
  })
}

/**
 * Calculate work center summary
 */
export function deriveWorkCenterSummary(jobs) {
  const summaryByWC = {}

  jobs.forEach((job) => {
    const key = job.WorkCenter || 'Unassigned'
    if (!summaryByWC[key]) {
      summaryByWC[key] = {
        workCenter: key,
        totalJobs: 0,
        lateJobs: 0,
        atRiskJobs: 0,
        onTrackJobs: 0
      }
    }

    const entry = summaryByWC[key]
    entry.totalJobs += 1
    
    if (job.status === 'Late') entry.lateJobs += 1
    else if (job.status === 'At Risk') entry.atRiskJobs += 1
    else if (job.status === 'On Track') entry.onTrackJobs += 1
  })

  const summary = Object.values(summaryByWC).map((entry) => ({
    ...entry,
    loadScore: entry.lateJobs * 3 + entry.atRiskJobs * 2 + entry.onTrackJobs * 1
  }))

  summary.sort((a, b) => b.loadScore - a.loadScore)
  return summary
}

/**
 * Format currency for display
 */
export function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0'
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/**
 * Log metrics for audit trail
 */
export function logMetricsCalculation(context, jobs, metrics) {
  console.log(`[Metrics: ${context}]`, {
    totalJobs: jobs.length,
    late: metrics.late,
    atRisk: metrics.atRisk,
    onTrack: metrics.onTrack,
    timestamp: new Date().toISOString()
  })
}
