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
          <h1 className="briefing-title">ShadowOps Daily Briefing</h1>
          <p className="briefing-subtitle">As of {formatDate(asOfDate)}</p>
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
                    {alert.severity === 'critical' && '🔴'}
                    {alert.severity === 'warning' && '🟠'}
                    {alert.severity === 'watch' && '🟡'}
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
            <p>✅ No critical risks detected.</p>
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
        <h2>Recommended Next Jobs</h2>
        {recommendedJobs.length > 0 ? (
          <div className="briefing-jobs-list">
            {recommendedJobs.map((job, idx) => (
              <div key={`${job.Job}-${idx}`} className="briefing-job-row">
                <div className="briefing-job-primary">
                  <span className="briefing-job-id">{job.Job}</span>
                  <span className="briefing-job-customer">{job.Customer || '—'}</span>
                </div>
                <div className="briefing-job-meta">
                  <span className="briefing-job-wc">{job.WorkCenter}</span>
                  <span className="briefing-job-due">{job.DueDate}</span>
                </div>
                <div className="briefing-job-status">
                  <StatusPill status={job.status} />
                </div>
                <div className="briefing-job-priority">
                  Score: {job.priorityScore.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="briefing-no-data">No jobs available.</p>
        )}
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
  if (score >= 10) return '🔴 Critical';
  if (score >= 5) return '🟠 High';
  if (score >= 1) return '🟡 Watch';
  return '🟢 Healthy';
}
