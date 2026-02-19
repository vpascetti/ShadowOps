import { useEffect, useState } from 'react';
import { getAllSuggestedActions, scoreActionUrgency } from '../utils/actionRecommendations';
import { calculateProgress, calculateScheduleRatio, determineStatus } from '../utils/metricsCalculations';
import '../styles/SuggestedActionsPanel.css';

/**
 * SuggestedActionsPanel Component
 * 
 * Displays AI-recommended actions ranked by urgency and impact.
 * Each action includes:
 * - What to do (title + description)
 * - Why (impact if not resolved)
 * - Who (responsibility)
 * - When (urgency window)
 */
export default function SuggestedActionsPanel({ jobs = [] }) {
  const [fallbackJobs, setFallbackJobs] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState(null);

  useEffect(() => {
    if (jobs && jobs.length > 0) return;
    if (fallbackLoading) return;

    const loadFallbackJobs = async () => {
      setFallbackLoading(true);
      setFallbackError(null);
      try {
        const res = await fetch('/demo/jobs');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'API error');
        }
        const payload = await res.json();
        const rawJobs = Array.isArray(payload.jobs)
          ? payload.jobs
          : Array.isArray(payload)
            ? payload
            : [];

        const normalized = rawJobs.map((job, index) => {
          const dueDate = job.DueDate || job.due_date || '';
          const startDate = job.StartDate || job.start_date || '';
          const qtyReleased = job.QtyReleased || job.qty_released || 0;
          const qtyCompleted = job.QtyCompleted || job.qty_completed || 0;
          const progress = calculateProgress(qtyReleased, qtyCompleted);
          const scheduleRatio = calculateScheduleRatio(startDate, dueDate, new Date());
          const status =
            job.status === 'Late' || job.status === 'At Risk' || job.status === 'On Track'
              ? job.status
              : determineStatus(dueDate, progress, scheduleRatio, new Date());

          return {
            ...job,
            Job: job.Job || job.job_id || job.job || `JOB-${index}`,
            DueDate: dueDate,
            StartDate: startDate,
            QtyReleased: qtyReleased,
            QtyCompleted: qtyCompleted,
            status,
            progress,
            scheduleRatio,
            risk_score: job.risk_score || 0,
            material_exception: job.material_exception || false,
            material_shortage: job.material_shortage || false,
            MaterialShortQty: job.MaterialShortQty || job.material_short_qty || 0
          };
        });

        setFallbackJobs(normalized);
      } catch (err) {
        setFallbackError(err.message);
      } finally {
        setFallbackLoading(false);
      }
    };

    loadFallbackJobs();
  }, [jobs, fallbackLoading]);

  const jobsToUse = jobs && jobs.length > 0 ? jobs : fallbackJobs;

  if (!jobsToUse || jobsToUse.length === 0) {
    if (fallbackLoading) {
      return (
        <section className="suggested-actions-panel">
          <h2>Suggested Actions</h2>
          <p className="empty-state">Loading suggested actions...</p>
        </section>
      );
    }
    if (fallbackError) {
      return (
        <section className="suggested-actions-panel">
          <h2>Suggested Actions</h2>
          <p className="empty-state">Unable to load jobs: {fallbackError}</p>
        </section>
      );
    }
    return (
      <section className="suggested-actions-panel">
        <h2>Suggested Actions</h2>
        <p className="empty-state">No jobs loaded yet. Connect to IQMS to see recommended actions.</p>
      </section>
    );
  }

  const actions = getAllSuggestedActions(jobsToUse);
  
  if (actions.length === 0) {
    return (
      <section className="suggested-actions-panel">
        <h2>Suggested Actions</h2>
        <p className="all-clear">All jobs on track. No corrective actions needed.</p>
      </section>
    );
  }

  const getCriticalCount = () => actions.filter(a => a.severity === 'critical').length;
  const getHighCount = () => actions.filter(a => a.severity === 'high').length;

  return (
    <section className="suggested-actions-panel">
      <div className="actions-header">
        <h2>Suggested Actions</h2>
        <div className="action-counts">
          {getCriticalCount() > 0 && (
            <span className="count critical">
              {getCriticalCount()} Critical
            </span>
          )}
          {getHighCount() > 0 && (
            <span className="count high">
              {getHighCount()} High
            </span>
          )}
          <span className="count info">
            {actions.length} Total
          </span>
        </div>
      </div>

      <div className="actions-list">
        {actions.slice(0, 10).map((action, idx) => {
          const urgencyScore = scoreActionUrgency(action);
          const urgencyPercent = Math.min((urgencyScore / 200) * 100, 100);

          return (
            <div key={action.action_id} className={`action-card action-${action.severity}`}>
              <div className="action-urgency-bar" style={{ width: `${urgencyPercent}%` }}></div>

              <div className="action-content">
                <div className="action-title-row">
                  <h3 className="action-title">{action.title}</h3>
                  <span className={`action-severity badge-${action.severity}`}>
                    {action.severity.toUpperCase()}
                  </span>
                </div>

                <p className="action-description">{action.description}</p>

                <div className="action-details">
                  <div className="detail-item">
                    <span className="detail-label">Owner:</span>
                    <span className="detail-value">{action.owner}</span>
                  </div>

                  {action.impact.hours_at_risk && (
                    <div className="detail-item">
                      <span className="detail-label">Risk:</span>
                      <span className="detail-value">
                        {Math.round(action.impact.hours_at_risk)}h at risk
                      </span>
                    </div>
                  )}

                  {action.due_in_hours !== undefined && (
                    <div className="detail-item">
                      <span className="detail-label">Due:</span>
                      <span className="detail-value">
                        {action.due_in_hours < 1
                          ? 'ASAP'
                          : action.due_in_hours < 24
                          ? `${action.due_in_hours.toFixed(0)}h`
                          : `${(action.due_in_hours / 24).toFixed(1)}d`}
                      </span>
                    </div>
                  )}

                  {action.effort_hours && action.effort_hours > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Effort:</span>
                      <span className="detail-value">~{action.effort_hours}h</span>
                    </div>
                  )}

                  <div className="detail-item">
                    <span className="detail-label">Job:</span>
                    <span className="detail-value">{action.job_id}</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
