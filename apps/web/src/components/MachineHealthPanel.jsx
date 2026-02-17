import React from 'react';
import { analyzeMachines } from '../utils/machineTendency';
import '../styles/MachineHealthPanel.css';

/**
 * Mini sparkline chart
 */
function Sparkline({ data = [], color = '#1976d2' }) {
  if (!data || data.length < 2) {
    return <div className="sparkline-placeholder">—</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline points={points} stroke={color} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MachineHealthPanel({ jobs = [] }) {
  if (!jobs || jobs.length === 0) {
    return (
      <section className="machine-health-panel">
        <h3>🤖 Machine Health & Predictive Maintenance</h3>
        <p className="empty-state">No jobs loaded yet. Upload a CSV to see machine predictions.</p>
      </section>
    );
  }

  const machines = analyzeMachines(jobs);

  const getCriticalCount = () => machines.filter((m) => m.current_health === 'critical').length;
  const getWarningCount = () => machines.filter((m) => m.current_health === 'warning').length;

  return (
    <section className="machine-health-panel">
      <div className="health-header">
        <h3>🤖 Machine Health & Predictive Maintenance</h3>
        <div className="health-counts">
          {getCriticalCount() > 0 && (
            <span className="count critical">{getCriticalCount()} Critical</span>
          )}
          {getWarningCount() > 0 && (
            <span className="count warning">{getWarningCount()} Warning</span>
          )}
          {machines.length - getCriticalCount() - getWarningCount() > 0 && (
            <span className="count healthy">
              {machines.length - getCriticalCount() - getWarningCount()} Healthy
            </span>
          )}
        </div>
      </div>

      <div className="machines-grid">
        {machines.map((machine) => (
          <div key={machine.resource_id} className={`machine-card health-${machine.current_health}`}>
            {/* Header */}
            <div className="machine-header">
              <div className="machine-name">{machine.resource_name || machine.resource_id}</div>
              <div className={`health-indicator health-${machine.current_health}`}>
                {machine.current_health === 'critical' && '🔴'}
                {machine.current_health === 'warning' && '🟡'}
                {machine.current_health === 'healthy' && '🟢'}
                {machine.current_health === 'unknown' && '⚪'}
              </div>
            </div>

            {/* Trend indicator */}
            <div className="trend-row">
              <div className="trend-label">Trend:</div>
              <div className={`trend-badge trend-${machine.trend}`}>
                {machine.trend === 'improving' && '📈 Improving'}
                {machine.trend === 'stable' && '➡️ Stable'}
                {machine.trend === 'degrading' && '📉 Degrading'}
                {machine.trend === 'critical' && '⚠️ Critical'}
                <span className="confidence">({machine.trend_confidence}%)</span>
              </div>
            </div>

            {/* Performance metrics */}
            <div className="metrics-compact">
              <div className="metric">
                <span className="metric-label">Cycle Time:</span>
                <span className="metric-value">{machine.avg_cycle_time.toFixed(1)}m</span>
                {machine.cycle_time_trend !== 0 && (
                  <span className={`metric-trend ${machine.cycle_time_trend > 0 ? 'degrading' : 'improving'}`}>
                    {machine.cycle_time_trend > 0 ? '↑' : '↓'} {Math.abs(machine.cycle_time_trend).toFixed(1)}m
                  </span>
                )}
              </div>

              <div className="metric">
                <span className="metric-label">Error Rate:</span>
                <span className="metric-value">{machine.error_rate.toFixed(1)}%</span>
                {machine.error_trend !== 0 && (
                  <span className={`metric-trend ${machine.error_trend > 0 ? 'degrading' : 'improving'}`}>
                    {machine.error_trend > 0 ? '↑' : '↓'} {Math.abs(machine.error_trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Predicted issues */}
            {machine.predicted_issues.length > 0 && (
              <div className="predicted-issues">
                <div className="issues-label">⚠️ Predicted Issues:</div>
                <ul className="issues-list">
                  {machine.predicted_issues.slice(0, 2).map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Maintenance & action */}
            <div className="maintenance-section">
              <div className="maintenance-due">
                <span className="label">Maintenance Due:</span>
                <span className={`value due-${machine.maintenance_due_in_days <= 7 ? 'urgent' : 'soon'}`}>
                  {machine.maintenance_due_in_days === 0 ? 'NOW' : `${machine.maintenance_due_in_days}d`}
                </span>
              </div>
              {machine.recommended_action && (
                <div className="recommended-action">
                  {machine.recommended_action}
                </div>
              )}
            </div>

            {/* Performance history sparkline */}
            {machine.history && machine.history.length > 1 && (
              <div className="history-sparkline">
                <div className="sparkline-label">Cycle Time Trend (30d)</div>
                <Sparkline
                  data={machine.history.map((h) => h.cycle_time_minutes)}
                  color={
                    machine.current_health === 'critical'
                      ? '#d32f2f'
                      : machine.current_health === 'warning'
                      ? '#f57c00'
                      : '#2e7d32'
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
