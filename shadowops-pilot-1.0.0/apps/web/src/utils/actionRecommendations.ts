/**
 * Action Recommendation Engine
 * 
 * Analyzes job characteristics and recommends prioritized actions
 * to resolve constraints, prevent issues, and optimize flow.
 */

export type ActionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SuggestedAction = {
  action_id: string;
  job_id: string;
  title: string;
  description: string;
  severity: ActionSeverity;
  /**
   * Impact if action not taken
   * - hours: hours of additional delay
   * - cost: estimated cost impact
   */
  impact: {
    hours_at_risk?: number;
    estimated_cost?: string;
  };
  /** Who needs to execute this action */
  owner: 'Planning' | 'Procurement' | 'Operations' | 'Maintenance' | 'Quality';
  /** Estimated time to resolve */
  effort_hours?: number;
  /** When this action should start */
  due_in_hours?: number;
};

/**
 * Analyze a job and generate recommended actions
 */
export function generateActionsForJob(job: any, jobIndex: number): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const jobId = job.Job || job.job_id || `JOB-${jobIndex}`;
  const riskScore = Number(job.risk_score || 0);
  const hasMaterialException =
    job.material_exception === true ||
    job.material_shortage === true ||
    Number(job.MaterialShortQty || job.material_short_qty || 0) > 0;

  // === MATERIAL-RELATED ACTIONS ===
  if (job.materialStatus === 'Short' || job.materialAvailable === false || hasMaterialException) {
    actions.push({
      action_id: `${jobId}-MAT-${jobIndex}`,
      job_id: jobId,
      title: 'Expedite Material Delivery',
      description: `Material shortage detected. Contact supplier to expedite delivery or consider substitutes.`,
      severity: job.status === 'Late' ? 'critical' : 'high',
      impact: {
        hours_at_risk: job.hoursAtRisk || 8,
        estimated_cost: undefined,
      },
      owner: 'Procurement',
      effort_hours: 2,
      due_in_hours: 2,
    });
  }

  // === CAPACITY-RELATED ACTIONS ===
  if (job.workCenterLoad && job.workCenterLoad > 100) {
    const overloadPct = Math.round(job.workCenterLoad - 100);
    actions.push({
      action_id: `${jobId}-CAP-${jobIndex}`,
      job_id: jobId,
      title: 'Rebalance Work Center Load',
      description: `${job.WorkCenter} is ${overloadPct}% overbooked. Consider parallel processing or shifting work to alternative centers.`,
      severity: job.status === 'Late' ? 'critical' : 'high',
      impact: {
        hours_at_risk: 4,
      },
      owner: 'Planning',
      effort_hours: 3,
      due_in_hours: 4,
    });
  }

  // === SEQUENCING/DEPENDENCY ACTIONS ===
  if (job.upstreamJobLate === true) {
    actions.push({
      action_id: `${jobId}-SEQ-${jobIndex}`,
      job_id: jobId,
      title: 'Expedite Prerequisite Job',
      description: `This job is blocked by an upstream job that's running late. Prioritize the dependency job first.`,
      severity: 'high',
      impact: {
        hours_at_risk: job.hoursAtRisk || 6,
      },
      owner: 'Operations',
      effort_hours: 0, // N/A - depends on upstream
      due_in_hours: 1,
    });
  }

  // === QUALITY-RELATED ACTIONS ===
  if (job.qualityHold === true) {
    actions.push({
      action_id: `${jobId}-QA-${jobIndex}`,
      job_id: jobId,
      title: 'Resolve Quality Hold',
      description: `Job is on quality hold. Investigate root cause and clear hold to resume production.`,
      severity: 'critical',
      impact: {
        hours_at_risk: job.hoursAtRisk || 12,
      },
      owner: 'Quality',
      effort_hours: 4,
      due_in_hours: 8,
    });
  }

  // === EQUIPMENT/DOWNTIME ACTIONS ===
  if (job.machineDowntime === true) {
    actions.push({
      action_id: `${jobId}-MTN-${jobIndex}`,
      job_id: jobId,
      title: 'Repair Equipment or Route Elsewhere',
      description: `${job.WorkCenter} is down or running slow. Schedule maintenance or route this job to an alternative work center.`,
      severity: 'critical',
      impact: {
        hours_at_risk: job.hoursAtRisk || 24,
      },
      owner: 'Maintenance',
      effort_hours: 6,
      due_in_hours: 0.5,
    });
  }

  // === LATE JOB ACTIONS ===
  if (job.status === 'Late') {
    actions.push({
      action_id: `${jobId}-LATE-${jobIndex}`,
      job_id: jobId,
      title: 'Customer Notification Required',
      description: `Job is past due date. Notify customer of actual completion date and any impact to their order.`,
      severity: 'high',
      impact: {
        hours_at_risk: 0,
      },
      owner: 'Planning',
      effort_hours: 1,
      due_in_hours: 1,
    });
  }

  // === SCHEDULE PRESSURE ACTIONS ===
  if (job.projectedStatus === 'Projected Late' && job.status !== 'Late') {
    actions.push({
      action_id: `${jobId}-PROJ-${jobIndex}`,
      job_id: jobId,
      title: 'Adjust Schedule or Add Resources',
      description: `Current pace projects late completion. Either reschedule the due date or add additional capacity.`,
      severity: job.daysAtRisk && job.daysAtRisk > 1 ? 'high' : 'medium',
      impact: {
        hours_at_risk: job.hoursAtRisk || 6,
      },
      owner: 'Planning',
      effort_hours: 2,
      due_in_hours: 24,
    });
  }

  if (job.status === 'At Risk') {
    actions.push({
      action_id: `${jobId}-RISK-${jobIndex}`,
      job_id: jobId,
      title: 'Recover Schedule Slip',
      description: `Job is behind schedule. Review capacity, sequence, and material availability to recover progress.`,
      severity: 'high',
      impact: {
        hours_at_risk: job.hoursAtRisk || 6,
      },
      owner: 'Planning',
      effort_hours: 2,
      due_in_hours: 12,
    });
  }

  if (riskScore >= 70 && job.status !== 'Late' && job.status !== 'At Risk') {
    actions.push({
      action_id: `${jobId}-RISK-${jobIndex}`,
      job_id: jobId,
      title: 'Mitigate High Risk Score',
      description: `Risk score is ${Math.round(riskScore)}. Confirm materials, staffing, and schedule buffers to prevent slippage.`,
      severity: 'medium',
      impact: {
        hours_at_risk: job.hoursAtRisk || 4,
      },
      owner: 'Planning',
      effort_hours: 1,
      due_in_hours: 24,
    });
  }

  return actions;
}

/**
 * Score action by urgency
 * Higher score = more urgent
 */
export function scoreActionUrgency(action: SuggestedAction): number {
  let score = 0;

  // Severity multiplier
  const severityScore = {
    critical: 100,
    high: 70,
    medium: 40,
    low: 10,
  };
  score += severityScore[action.severity];

  // Impact multiplier
  if (action.impact.hours_at_risk) {
    score += Math.min(action.impact.hours_at_risk * 2, 50);
  }

  // Due-in-hours multiplier (more urgent if due sooner)
  if (action.due_in_hours) {
    score += Math.max(0, 50 - action.due_in_hours * 5);
  }

  return Math.min(score, 200); // Cap at 200
}

/**
 * Get all suggested actions across all jobs, ranked by urgency
 */
export function getAllSuggestedActions(jobs: any[]): SuggestedAction[] {
  const allActions: SuggestedAction[] = [];

  jobs.forEach((job, index) => {
    const jobActions = generateActionsForJob(job, index);
    allActions.push(...jobActions);
  });

  // Sort by urgency score (descending)
  return allActions.sort((a, b) => scoreActionUrgency(b) - scoreActionUrgency(a));
}
