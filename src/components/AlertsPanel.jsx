import '../styles/AlertsPanel.css';

export default function AlertsPanel({ alerts }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="alerts-panel">
      <h3 className="alerts-title">⚠️ ShadowOps Alerts</h3>
      <div className="alerts-list">
        {alerts.map((alert) => (
          <div key={alert.id} className={`alert-item alert-${alert.severity}`}>
            <div className="alert-header">
              <span className={`alert-icon alert-icon-${alert.severity}`}>
                {alert.severity === 'critical' && '🔴'}
                {alert.severity === 'warning' && '🟠'}
                {alert.severity === 'watch' && '🟡'}
              </span>
              <span className="alert-title-text">{alert.title}</span>
              <span className="alert-badge">{alert.jobId}</span>
            </div>
            <div className="alert-body">
              <span className="alert-description">{alert.description}</span>
              <span className="alert-meta">{alert.workCenter}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
