import React from 'react';
import '../styles/DiagnosticInfo.css';

/**
 * DiagnosticInfo Component
 * 
 * Displays actionable constraint information for a job:
 * - Primary constraint (what's blocking progress)
 * - Root cause (why is this constraint happening)
 * - Impact (hours/days at risk)
 * - Who's accountable (what action needed)
 */
export default function DiagnosticInfo({ job, importStats }) {
  if (!job) return <div className="diagnostic-info">—</div>;

  // Determine primary constraint
  const getConstraint = () => {
    // Material constraint
    if (job.materialStatus === 'Short' || job.materialAvailable === false) {
      return {
        type: 'MATERIAL',
        label: 'Material Shortage',
        icon: '📦',
        severity: 'high',
        description: `Missing or short on materials for ${job.Job}`
      };
    }

    // Capacity constraint
    if (job.capacityPressure === true || job.workCenterLoad > 100) {
      const loadPct = job.workCenterLoad ? Math.round(job.workCenterLoad) : '?';
      return {
        type: 'CAPACITY',
        label: `Overloaded (${loadPct}%)`,
        icon: '⚙️',
        severity: 'high',
        description: `${job.WorkCenter} is at ${loadPct}% capacity`
      };
    }

    // Sequencing constraint (upstream job late)
    if (job.upstreamJobLate === true) {
      return {
        type: 'SEQUENCE',
        label: 'Waiting on Upstream',
        icon: '⏳',
        severity: 'medium',
        description: 'Cannot start until prerequisite job completes'
      };
    }

    // Quality hold
    if (job.qualityHold === true) {
      return {
        type: 'QUALITY',
        label: 'Quality Hold',
        icon: '🚫',
        severity: 'high',
        description: 'Job is on quality hold'
      };
    }

    // Downtime/slowdown
    if (job.machineDowntime === true) {
      return {
        type: 'DOWNTIME',
        label: 'Equipment Down',
        icon: '🔴',
        severity: 'high',
        description: `${job.WorkCenter} is currently down or running slow`
      };
    }

    // Default: schedule pressure
    return {
      type: 'SCHEDULE',
      label: 'Schedule Pressure',
      icon: '📅',
      severity: 'medium',
      description: 'Job is behind schedule'
    };
  };

  const constraint = getConstraint();

  // Calculate impact
  const getImpact = () => {
    if (job.hoursAtRisk) {
      return `${Math.round(job.hoursAtRisk)}h at risk`;
    }
    if (job.daysAtRisk) {
      return `${Math.round(job.daysAtRisk)} days late`;
    }
    return 'TBD';
  };

  // Get recommended action
  const getRecommendedAction = () => {
    switch (constraint.type) {
      case 'MATERIAL':
        return 'Expedite material or reschedule';
      case 'CAPACITY':
        return 'Shift load or parallel process';
      case 'SEQUENCE':
        return 'Expedite upstream job';
      case 'QUALITY':
        return 'Resolve quality issue first';
      case 'DOWNTIME':
        return 'Repair equipment or redirect work';
      default:
        return 'Review schedule and constraints';
    }
  };

  return (
    <div className="diagnostic-info">
      <div className={`constraint-badge constraint-${constraint.type.toLowerCase()}`}>
        <span className="constraint-icon">{constraint.icon}</span>
        <span className="constraint-label">{constraint.label}</span>
      </div>

      <div className="diagnostic-details">
        <div className="diagnostic-row">
          <span className="diagnostic-label">Constraint:</span>
          <span className="diagnostic-value">{constraint.description}</span>
        </div>

        <div className="diagnostic-row">
          <span className="diagnostic-label">Impact:</span>
          <span className="diagnostic-value">{getImpact()}</span>
        </div>

        <div className="diagnostic-row">
          <span className="diagnostic-label">Action:</span>
          <span className="diagnostic-action">{getRecommendedAction()}</span>
        </div>
      </div>

      {job.status === 'Late' && (
        <div className="late-indicator">
          ⚠️ OVERDUE: {job.DueDate}
        </div>
      )}
    </div>
  );
}
