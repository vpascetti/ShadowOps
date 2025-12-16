import '../styles/RunListPanel.css';

export default function RunListPanel({ runList }) {
  // Only show work centers with risky jobs (for clarity)
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
      <h3 className="run-list-title">🎯 WorkCenter Priority Run List</h3>
      <div className="run-list-grid">
        {relevantWCs.map((wc) => (
          <div key={wc.workCenter} className="run-list-wc-card">
            <div className="run-list-wc-header">
              <h4>{wc.workCenter}</h4>
              <span className="run-list-job-count">{wc.jobs.length} jobs</span>
            </div>
            <div className="run-list-jobs">
              {wc.jobs.slice(0, 3).map((job, idx) => (
                <div key={`${job.Job}-${idx}`} className="run-list-job-row">
                  <div className="run-list-job-info">
                    <span className="run-list-job-id">{job.Job}</span>
                    <span className="run-list-job-customer">{job.Customer || '—'}</span>
                  </div>
                  <div className="run-list-job-dates">
                    <span className="run-list-due-date">{job.DueDate}</span>
                  </div>
                  <div className="run-list-job-status">
                    <span className={`run-list-status-badge status-${job.status.toLowerCase().replace(' ', '-')}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="run-list-priority-score">
                    {job.priorityScore.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
