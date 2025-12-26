import '../styles/LoadSummaryPanel.css';

export default function LoadSummaryPanel({ loadSummary }) {
  if (loadSummary.length === 0) {
    return null;
  }

  return (
    <div className="load-summary-panel">
      <h3 className="load-summary-title">📊 WorkCenter Load Summary</h3>
      <div className="load-summary-container">
        <div className="load-summary-cards">
          {loadSummary.map((wc) => (
            <div key={wc.workCenter} className="load-summary-card">
              <div className="load-summary-header">
                <h4 className="load-summary-wc-name">{wc.workCenter}</h4>
                <span className={`load-summary-severity load-severity-${getLoadSeverity(wc.loadScore)}`}>
                  {getLoadLabel(wc.loadScore)}
                </span>
              </div>
              <div className="load-summary-stats">
                <div className="load-stat" title="Total jobs currently loaded on this work center">
                  <span className="load-stat-label">Total</span>
                  <span className="load-stat-value">{wc.totalJobs}</span>
                </div>
                <div className="load-stat" title="Jobs that are already past their due date">
                  <span className="load-stat-label">Late</span>
                  <span className="load-stat-value late">{wc.lateJobs}</span>
                </div>
                <div className="load-stat" title="Jobs projected to finish after their due date">
                  <span className="load-stat-label">Proj. Late</span>
                  <span className="load-stat-value projected-late">{wc.projectedLateJobs}</span>
                </div>
                <div className="load-stat" title="Jobs behind schedule and at risk of being late">
                  <span className="load-stat-label">At Risk</span>
                  <span className="load-stat-value at-risk">{wc.atRiskJobs}</span>
                </div>
              </div>
              <div className="load-summary-score" title="Load Score">
                <span>Score: {wc.loadScore}</span>
              </div>
            </div>
          ))}
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
  if (score >= 10) return '🔴 Critical';
  if (score >= 5) return '🟠 High';
  if (score >= 1) return '🟡 Watch';
  return '🟢 Healthy';
}
