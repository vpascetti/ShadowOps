import '../styles/LoadSummaryPanel.css';

export default function LoadSummaryPanel({ loadSummary }) {
  if (loadSummary.length === 0) {
    return null;
  }

  // Sort by severity (critical jobs first)
  const sortedWCs = [...loadSummary].sort((a, b) => {
    const criticalA = a.lateJobs + a.atRiskJobs;
    const criticalB = b.lateJobs + b.atRiskJobs;
    if (criticalA !== criticalB) return criticalB - criticalA;
    return b.totalJobs - a.totalJobs;
  });

  return (
    <div className="load-summary-panel">
      <h3 className="load-summary-title">Work Center Load</h3>
      <div className="load-summary-container">
        <div className="load-summary-cards">
          {sortedWCs.map((wc) => {
            const criticalCount = wc.lateJobs + wc.atRiskJobs;
            const severity = getLoadSeverity(wc.loadScore);
            const onTrackJobs = wc.totalJobs - wc.lateJobs - wc.projectedLateJobs - wc.atRiskJobs;
            
            // Calculate load percentage (using critical/total as proxy for capacity utilization)
            const loadPct = wc.totalJobs > 0 ? Math.round((criticalCount / wc.totalJobs) * 100) : 0;

            return (
              <div key={wc.workCenter} className={`load-summary-card severity-${severity}`}>
                <div className="load-summary-header">
                  <h4 className="load-summary-wc-name">{wc.workCenter}</h4>
                  <span className={`load-summary-severity load-severity-${severity}`}>
                    {getLoadLabel(wc.loadScore)}
                  </span>
                </div>

                {/* Priority metrics */}
                <div className="load-summary-priority">
                  <div className="priority-metric critical">
                    <span className="priority-count">{criticalCount}</span>
                    <span className="priority-label">Critical jobs</span>
                  </div>
                  <div className="priority-metric total">
                    <span className="priority-count">{wc.totalJobs}</span>
                    <span className="priority-label">Total queued</span>
                  </div>
                </div>

                {/* Load bar visualization */}
                <div className="load-bar-container">
                  <div className="load-bar-label">
                    <span>Load Status</span>
                    <span className="load-bar-pct">{loadPct}% critical</span>
                  </div>
                  <div className="load-bar">
                    <div 
                      className="load-bar-fill late" 
                      style={{ width: `${(wc.lateJobs / wc.totalJobs) * 100}%` }}
                      title={`${wc.lateJobs} late`}
                    />
                    <div 
                      className="load-bar-fill at-risk" 
                      style={{ width: `${(wc.atRiskJobs / wc.totalJobs) * 100}%` }}
                      title={`${wc.atRiskJobs} at risk`}
                    />
                    <div 
                      className="load-bar-fill projected" 
                      style={{ width: `${(wc.projectedLateJobs / wc.totalJobs) * 100}%` }}
                      title={`${wc.projectedLateJobs} projected late`}
                    />
                  </div>
                  <div className="load-bar-legend">
                    <span className="legend-item">
                      <span className="legend-dot late"></span>
                      {wc.lateJobs} Late
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot at-risk"></span>
                      {wc.atRiskJobs} At Risk
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot projected"></span>
                      {wc.projectedLateJobs} Proj. Late
                    </span>
                    {onTrackJobs > 0 && (
                      <span className="legend-item on-track">
                        {onTrackJobs} On Track
                      </span>
                    )}
                  </div>
                </div>

                {/* Action recommendation */}
                {severity === 'critical' && (
                  <div className="load-action critical">
                    <span className="action-icon">⚠️</span>
                    <span className="action-text">Immediate intervention needed</span>
                  </div>
                )}
                {severity === 'warning' && (
                  <div className="load-action warning">
                    <span className="action-icon">⚡</span>
                    <span className="action-text">Monitor closely, consider expediting</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getLoadSeverity(score) {
  if (score >= 10) return 'critical';
  if (score >= 5) return 'warning';
  if (score >= 1) return 'watch';
  return 'healthy';
}

function getLoadLabel(score) {
  if (score >= 10) return 'Critical';
  if (score >= 5) return 'High';
  if (score >= 1) return 'Watch';
  return 'Healthy';
}
