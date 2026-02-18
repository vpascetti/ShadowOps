import MetricCard from './MetricCard';
import StatusPill from './StatusPill';
import '../styles/DailyBriefing.css';

export default function DailyBriefing({
  metrics,
  alerts,
  runList,
  loadSummary,
  asOfDate,
  jobs,
}) {
  // Format the asOfDate for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Count projected late jobs
  const projectedLateCount = jobs ? jobs.filter((j) => j.projectedStatus === 'Projected Late').length : 0;

  // Get top 3 alerts
  const topAlerts = alerts.slice(0, 3);

  // Get top 3 work centers by load
  const topHotspots = loadSummary.slice(0, 3);

  // Get top 3 highest-priority jobs overall from run list
  const topJobsOverall = [];
  runList.forEach((wc) => {
    wc.jobs.forEach((job) => {
      topJobsOverall.push(job);
    });
  });
  topJobsOverall.sort((a, b) => b.priorityScore - a.priorityScore);
  const recommendedJobs = topJobsOverall.slice(0, 3);

  return (
    <div className="daily-briefing">
      {/* Header */}
      <div className="briefing-header">
        <div className="briefing-header-content">
          <h1 className="briefing-title">ShadowOps Executive Briefing</h1>
          <p className="briefing-subtitle">As of {formatDate(asOfDate)}</p>
          <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.85rem' }}>Data source: CSV snapshot</p>
        </div>
      </div>

      {/* Metrics Summary */}
      <section className="briefing-section briefing-metrics">
        <h2>Summary</h2>
        <div className="briefing-metrics-grid">
          <MetricCard label="Total Jobs" value={metrics.total} color="neutral" />
          <MetricCard label="Late" value={metrics.late} color="red" />
          <MetricCard label="Projected Late" value={projectedLateCount} color="orange" />
          <MetricCard label="At Risk" value={metrics.atRisk} color="orange" />
        </div>
      </section>

      {/* Top Risks */}
      <section className="briefing-section briefing-risks">
        <h2>Top Risks</h2>
        {topAlerts.length > 0 ? (
          <div className="briefing-alerts-list">
            {topAlerts.map((alert) => (
              <div key={alert.id} className={`briefing-alert-item alert-${alert.severity}`}>
                <div className="briefing-alert-header">
                  <span className="briefing-alert-icon">
                    {alert.severity === 'critical' && 'Critical'}
                    {alert.severity === 'warning' && 'Warning'}
                    {alert.severity === 'watch' && 'Watch'}
                  </span>
                  <div className="briefing-alert-title">{alert.title}</div>
                  <span className="briefing-alert-job">{alert.jobId}</span>
                </div>
                <p className="briefing-alert-desc">{alert.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="briefing-no-alerts">
            <p>No critical risks detected.</p>
          </div>
        )}
      </section>

      {/* WorkCenter Hotspots */}
      <section className="briefing-section briefing-hotspots">
        <h2>WorkCenter Hotspots</h2>
        {topHotspots.length > 0 ? (
          <div className="briefing-hotspots-grid">
            {topHotspots.map((wc) => (
              <div key={wc.workCenter} className="briefing-hotspot-card">
                <div className="briefing-hotspot-header">
                  <h3 className="briefing-hotspot-name">{wc.workCenter}</h3>
                  <span className={`briefing-hotspot-severity severity-${getSeverity(wc.loadScore)}`}>
                    {getSeverityLabel(wc.loadScore)}
                  </span>
                </div>
                <div className="briefing-hotspot-stats">
                  <div className="briefing-stat">
                    <span className="briefing-stat-label">Total</span>
                    <span className="briefing-stat-value">{wc.totalJobs}</span>
                  </div>
                  <div className="briefing-stat">
                    <span className="briefing-stat-label">Late</span>
                    <span className="briefing-stat-value late">{wc.lateJobs}</span>
                  </div>
                  <div className="briefing-stat">
                    <span className="briefing-stat-label">Proj. Late</span>
                    <span className="briefing-stat-value late">{wc.projectedLateJobs}</span>
                  </div>
                  <div className="briefing-stat">
                    <span className="briefing-stat-label">At Risk</span>
                    <span className="briefing-stat-value risk">{wc.atRiskJobs}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="briefing-no-data">No hotspots detected.</p>
        )}
      </section>

      {/* Recommended Next Jobs */}
      <section className="briefing-section briefing-recommended">
        <h2>What ShadowOps Recommends</h2>
        <div style={{ padding: '0.5rem 0' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {recommendedJobs[0] ? (
              <li>
                Run Job {recommendedJobs[0].Job} next on {recommendedJobs[0].WorkCenter}
              </li>
            ) : (
              <li>No recommended next job.</li>
            )}

            {topHotspots[0] ? (
              <li>Avoid starting new jobs on {topHotspots[0].workCenter} today.</li>
            ) : (
              <li>No overloaded work centers detected.</li>
            )}

            {jobs.find((j) => j.projectedStatus === 'Projected Late') ? (
              <li>
                Some jobs are projected late — prioritize finishing partially completed work.
              </li>
            ) : (
              <li>No projected late jobs at this snapshot.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <div className="briefing-footer">
        <p>Switch to Dashboard view for detailed analysis and filtering.</p>
      </div>
    </div>
  );
}

function getSeverity(score) {
  if (score >= 10) return 'critical';
  if (score >= 5) return 'warning';
  if (score >= 1) return 'watch';
  return 'healthy';
}

function getSeverityLabel(score) {
  if (score >= 10) return 'Critical';
  if (score >= 5) return 'High';
  if (score >= 1) return 'Watch';
  return 'Healthy';
}
