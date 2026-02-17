/**
 * Machine Tendency Analysis Engine
 * 
 * Tracks work center performance trends and predicts issues:
 * - Performance degradation (getting slower)
 * - Reliability issues (increasing errors/downtime)
 * - Maintenance needs
 * - Capacity trending
 */

export type MachineTrend = 'improving' | 'stable' | 'degrading' | 'critical';
export type MachineHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface HistoricalPerformance {
  timestamp: string;
  cycle_time_minutes: number;
  output_units: number;
  error_rate: number; // 0-1
  downtime_minutes: number;
  utilization_percent: number;
}

export interface MachineTendency {
  resource_id: string;
  resource_name: string;
  current_health: MachineHealthStatus;
  trend: MachineTrend;
  /** Confidence in prediction (0-100) */
  trend_confidence: number;
  /** Average cycle time (minutes) */
  avg_cycle_time: number;
  /** Cycle time trend (positive = getting slower) */
  cycle_time_trend: number;
  /** Error rate (0-100) */
  error_rate: number;
  /** Error rate trend (positive = getting worse) */
  error_trend: number;
  /** Predicted downtime in next 7 days (hours) */
  predicted_downtime_hours: number;
  /** Days until maintenance recommended */
  maintenance_due_in_days: number;
  /** Historical performance data */
  history: HistoricalPerformance[];
  /** Predicted issues if not addressed */
  predicted_issues: string[];
  /** Recommended action */
  recommended_action?: string;
}

/**
 * Generate synthetic historical performance data for testing
 */
export function generateHistoricalPerformance(
  resourceId: string,
  days: number = 30
): HistoricalPerformance[] {
  const history: HistoricalPerformance[] = [];
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    const daysAgo = i;
    const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // Simulate degradation for certain machines
    let degradationFactor = 1.0;
    if (resourceId === 'WC-10') {
      // WC-10: degrading (getting slower over time)
      degradationFactor = 1.0 + (i / days) * 0.3; // 30% slower by end
    } else if (resourceId === 'WC-20') {
      // WC-20: stable, healthy
      degradationFactor = 1.0 + Math.random() * 0.05;
    } else if (resourceId === 'WC-30') {
      // WC-30: error spikes, unreliable
      degradationFactor = 1.0 + Math.random() * 0.1;
    }

    history.push({
      timestamp,
      cycle_time_minutes: 45 * degradationFactor + Math.random() * 10,
      output_units: 100 * (1 - Math.random() * 0.2),
      error_rate: (resourceId === 'WC-30' ? 0.08 : 0.02) + Math.random() * 0.03,
      downtime_minutes: resourceId === 'WC-30' ? 60 + Math.random() * 120 : 15 + Math.random() * 30,
      utilization_percent: 75 + Math.random() * 20,
    });
  }

  return history;
}

/**
 * Analyze machine tendency from historical data
 */
export function analyzeMachineTendency(
  resourceId: string,
  resourceName: string,
  history: HistoricalPerformance[]
): MachineTendency {
  if (!history || history.length < 3) {
    return {
      resource_id: resourceId,
      resource_name: resourceName,
      current_health: 'unknown',
      trend: 'stable',
      trend_confidence: 0,
      avg_cycle_time: 0,
      cycle_time_trend: 0,
      error_rate: 0,
      error_trend: 0,
      predicted_downtime_hours: 0,
      maintenance_due_in_days: 0,
      history: [],
      predicted_issues: [],
    };
  }

  // Split into recent (last 7 days) and older data
  const recentWindow = Math.min(7, Math.ceil(history.length / 4));
  const recent = history.slice(-recentWindow);
  const older = history.slice(0, -recentWindow);

  // Calculate metrics
  const recentCycleTime = recent.reduce((sum, d) => sum + d.cycle_time_minutes, 0) / recent.length;
  const olderCycleTime = older.length > 0 ? older.reduce((sum, d) => sum + d.cycle_time_minutes, 0) / older.length : recentCycleTime;
  const cycleTimeTrend = recentCycleTime - olderCycleTime;

  const recentErrorRate = recent.reduce((sum, d) => sum + d.error_rate, 0) / recent.length;
  const olderErrorRate = older.length > 0 ? older.reduce((sum, d) => sum + d.error_rate, 0) / older.length : recentErrorRate;
  const errorTrend = recentErrorRate - olderErrorRate;

  const avgDowntime = history.reduce((sum, d) => sum + d.downtime_minutes, 0) / history.length;
  const predictedDowntimeHours = (avgDowntime / 60) * 7; // Extrapolate to 7 days

  // Determine trend
  let trend: MachineTrend = 'stable';
  let confidence = 50;

  if (cycleTimeTrend > 5 || errorTrend > 0.03) {
    trend = 'degrading';
    confidence = Math.min(Math.abs(cycleTimeTrend) * 5 + errorTrend * 50, 95);
  } else if (cycleTimeTrend < -3) {
    trend = 'improving';
    confidence = Math.min(Math.abs(cycleTimeTrend) * 5, 90);
  }

  // Determine health status
  let health: MachineHealthStatus = 'healthy';
  let maintenanceDue = 30;

  if (errorTrend > 0.04 || recentErrorRate > 0.1) {
    health = 'critical';
    maintenanceDue = 2;
  } else if (cycleTimeTrend > 8 || recentErrorRate > 0.07) {
    health = 'warning';
    maintenanceDue = 7;
  } else if (avgDowntime > 90) {
    health = 'warning';
    maintenanceDue = 10;
  }

  // Predict issues
  const predictedIssues: string[] = [];
  if (cycleTimeTrend > 5) {
    predictedIssues.push(`Cycle time increasing (${cycleTimeTrend.toFixed(1)}m/week trend)`);
  }
  if (errorTrend > 0.03) {
    predictedIssues.push(`Error rate degrading (${(errorTrend * 100).toFixed(1)}% trend)`);
  }
  if (avgDowntime > 80) {
    predictedIssues.push(`High unplanned downtime (${avgDowntime.toFixed(0)}min avg)`);
  }
  if (predictedDowntimeHours > 8) {
    predictedIssues.push(`Risk of ${predictedDowntimeHours.toFixed(0)}+ hours downtime in next week`);
  }

  return {
    resource_id: resourceId,
    resource_name: resourceName,
    current_health: health,
    trend,
    trend_confidence: confidence,
    avg_cycle_time: recentCycleTime,
    cycle_time_trend: cycleTimeTrend,
    error_rate: recentErrorRate * 100,
    error_trend: errorTrend * 100,
    predicted_downtime_hours: predictedDowntimeHours,
    maintenance_due_in_days: maintenanceDue,
    history,
    predicted_issues,
    recommended_action:
      health === 'critical'
        ? 'Schedule maintenance immediately'
        : health === 'warning'
        ? `Plan maintenance within ${maintenanceDue} days`
        : 'Continue monitoring',
  };
}

/**
 * Analyze all machines
 */
export function analyzeMachines(jobs: any[]): MachineTendency[] {
  const workCenters = new Set<string>();
  const machineNames: Record<string, string> = {
    'WC-10': 'Assembly Line A',
    'WC-20': 'Precision Lathe',
    'WC-30': 'Welding Station',
  };

  // Extract unique work centers
  jobs.forEach((job) => {
    if (job.WorkCenter) {
      workCenters.add(job.WorkCenter);
    }
  });

  // Analyze each machine
  return Array.from(workCenters)
    .map((wc) => {
      const history = generateHistoricalPerformance(wc, 30);
      return analyzeMachineTendency(wc, machineNames[wc] || wc, history);
    })
    .sort((a, b) => {
      // Sort by health (critical first) then by trend
      const healthOrder = { critical: 0, warning: 1, healthy: 2, unknown: 3 };
      const healthDiff = healthOrder[a.current_health] - healthOrder[b.current_health];
      if (healthDiff !== 0) return healthDiff;

      const trendOrder = { critical: 0, degrading: 1, stable: 2, improving: 3 };
      return trendOrder[a.trend] - trendOrder[b.trend];
    });
}
