import '../styles/RunListPanel.css';

// Helper function to calculate days overdue/until due
function getDaysToDue(dueDateStr) {
  if (!dueDateStr) return null;
  try {
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffMs = dueDate.getTime() - today.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

// Helper function to format currency
function formatRevenue(val) {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return null;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

// Determine what's blocking a job
function getBlockers(job) {
  const blockers = [];
  
  // Material shortage
  if (job.MaterialShortage || job.material_shortage || job.MaterialShortQty > 0) {
    blockers.push({ type: 'material', label: 'Material' });
  }
  
  // Behind schedule (capacity/labor issue)
  if (job.status === 'At Risk' && job.progress !== null && job.progress < 0.5) {
    blockers.push({ type: 'capacity', label: 'Capacity' });
  }
  
  return blockers;
}

// Calculate work remaining vs time remaining
function getWorkTimeRatio(job) {
  const daysToDue = getDaysToDue(job.DueDate);
  if (daysToDue === null || job.progress === null) return null;
  
  const workRemaining = 1 - job.progress; // 0-1
  // If job is late, any work remaining is critical
  if (daysToDue < 0) return 'overdue';
  // If less than 2 days and more than 20% work remaining, it's tight
  if (daysToDue <= 2 && workRemaining > 0.2) return 'tight';
  // If work remaining is more than days available (assuming 1 day per 50% work)
  if (workRemaining * 2 > daysToDue / 2) return 'tight';
  return 'ok';
}

export default function RunListPanel({ runList }) {
  // Only show work centers with risky jobs
  const relevantWCs = runList.filter((wc) =>
    wc.jobs.some(
      (job) =>
        job.status === 'Late' ||
        job.status === 'At Risk' ||
        job.projectedStatus === 'Projected Late'
    )
  );

  if (relevantWCs.length === 0) {
    return null;
  }

  return (
    <div className="run-list-panel">
      <h3 className="run-list-title">Schedule & Priority</h3>
      <div className="run-list-grid">
        {relevantWCs.map((wc) => {
          // Sort jobs by: late first, then by revenue, then by days to due
          const sortedJobs = [...wc.jobs].sort((a, b) => {
            if (a.status === 'Late' && b.status !== 'Late') return -1;
            if (b.status === 'Late' && a.status !== 'Late') return 1;
            
            const revenueA = parseFloat(a.total_order_value || 0);
            const revenueB = parseFloat(b.total_order_value || 0);
            if (revenueA !== revenueB) return revenueB - revenueA;
            
            const daysA = getDaysToDue(a.DueDate) ?? 999;
            const daysB = getDaysToDue(b.DueDate) ?? 999;
            return daysA - daysB;
          });

          return (
            <div key={wc.workCenter} className="run-list-wc-card">
              <div className="run-list-wc-header">
                <h4>{wc.workCenter}</h4>
                <span className="run-list-job-count">{wc.jobs.length} jobs</span>
              </div>
              <div className="run-list-jobs">
                {sortedJobs.slice(0, 3).map((job, idx) => {
                  const daysToDue = getDaysToDue(job.DueDate);
                  const revenue = formatRevenue(job.total_order_value);
                  const blockers = getBlockers(job);
                  const timeRatio = getWorkTimeRatio(job);
                  const progressPct = job.progress !== null ? Math.round(job.progress * 100) : null;
                  const revenueClass =
                    daysToDue !== null && daysToDue < 0
                      ? 'revenue-late'
                      : job.status === 'At Risk' ||
                          job.projectedStatus === 'Projected Late' ||
                          (daysToDue !== null && daysToDue <= 2)
                        ? 'revenue-at-risk'
                        : 'revenue-on-track';

                  return (
                    <div key={`${job.Job}-${idx}`} className="run-list-job-row">
                      <div className="run-list-job-header">
                        <div className="run-list-job-info">
                          <span className="run-list-job-id">{job.Job}</span>
                          <span className="run-list-job-customer">{job.Customer || '—'}</span>
                        </div>
                        {revenue && (
                          <span
                            className={`run-list-revenue ${revenueClass}`}
                            title="Order value at risk"
                          >
                            {revenue}
                          </span>
                        )}
                      </div>

                      <div className="run-list-job-metrics">
                        {/* Time pressure */}
                        <div className="run-list-metric">
                          <span className="metric-label">Due:</span>
                          {daysToDue !== null ? (
                            <span className={`metric-value ${daysToDue < 0 ? 'overdue' : daysToDue <= 2 ? 'urgent' : ''}`}>
                              {daysToDue < 0 ? `${Math.abs(daysToDue)}d overdue` : daysToDue === 0 ? 'Today' : `${daysToDue}d`}
                            </span>
                          ) : (
                            <span className="metric-value">—</span>
                          )}
                        </div>

                        {/* Progress */}
                        {progressPct !== null && (
                          <div className="run-list-metric">
                            <span className="metric-label">Complete:</span>
                            <span className={`metric-value ${progressPct < 50 ? 'behind' : ''}`}>
                              {progressPct}%
                            </span>
                          </div>
                        )}

                        {/* Time ratio warning */}
                        {timeRatio === 'tight' && (
                          <div className="run-list-metric">
                            <span className="metric-warning">⚠️ Tight timeline</span>
                          </div>
                        )}
                      </div>

                      {/* Blockers */}
                      {blockers.length > 0 && (
                        <div className="run-list-blockers">
                          <span className="blockers-label">Blocked by:</span>
                          {blockers.map((blocker, i) => (
                            <span key={i} className={`blocker-badge blocker-${blocker.type}`}>
                              {blocker.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
