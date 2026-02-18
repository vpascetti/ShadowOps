import React from 'react';
import { getAllSuggestedActions, scoreActionUrgency } from '../utils/actionRecommendations';
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
  if (!jobs || jobs.length === 0) {
    return (
      <section className="suggested-actions-panel">
        <h2>Suggested Actions</h2>
        <p className="empty-state">No jobs loaded yet. Connect to IQMS to see recommended actions.</p>
      </section>
    );
  }

  const actions = getAllSuggestedActions(jobs);
  
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

                <button 
                  className={`action-button button-${action.severity}`}
                >
                  Take Action →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {actions.length > 10 && (
        <div className="actions-footer">
          <p>Showing 10 of {actions.length} recommended actions. View all →</p>
        </div>
      )}
    </section>
  );
}
