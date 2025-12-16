import { useRef, useState, useEffect } from 'react';
import StatusPill from './StatusPill';
import ProgressBar from './ProgressBar';
import MetricCard from './MetricCard';
import JobTimeline from './JobTimeline';
import AlertsPanel from './AlertsPanel';
import RunListPanel from './RunListPanel';
import LoadSummaryPanel from './LoadSummaryPanel';
import SectionNavBar from './SectionNavBar';
import '../styles/DashboardView.css';

export default function DashboardView({
  jobs,
  filteredJobs,
  sortedJobs,
  metrics,
  alerts,
  runList,
  loadSummary,
  workCenterSummary,
  workCenters,
  asOfDate,
  statusFilter,
  workCenterFilter,
  sortField,
  sortOrder,
  selectedDate,
  fileName,
  setStatusFilter,
  setWorkCenterFilter,
  setSortField,
  setSortOrder,
  handleSort,
  handleDateInputChange,
  handleApplyDate,
  parseDate,
  handleFileUpload,
}) {
  // Create refs for section navigation
  const alertsRef = useRef(null);
  const runListRef = useRef(null);
  const loadSummaryRef = useRef(null);
  const bottlenecksRef = useRef(null);
  const jobsTableRef = useRef(null);

  const sections = [
    { label: 'Alerts', ref: alertsRef },
    { label: 'Run List', ref: runListRef },
    { label: 'Load Summary', ref: loadSummaryRef },
    { label: 'Bottlenecks', ref: bottlenecksRef },
    { label: 'Jobs Table', ref: jobsTableRef },
  ];

  const [activeSection, setActiveSection] = useState('Alerts');

  useEffect(() => {
    const refs = [alertsRef, runListRef, loadSummaryRef, bottlenecksRef, jobsTableRef];
    const observerOptions = {
      root: null,
      rootMargin: '-40% 0px -40% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const match = sections.find((s) => s.ref.current === entry.target);
          if (match) setActiveSection(match.label);
        }
      });
    }, observerOptions);

    refs.forEach((r) => {
      if (r && r.current) observer.observe(r.current);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="dashboard-view">
      <div className="app-container">
        {/* Left Section: Upload & Instructions */}
        <section className="upload-section">
          <h2>Upload Jobs CSV</h2>
          <p className="instructions">
            Upload a CSV file with columns: Job, Part, Customer, WorkCenter, StartDate, DueDate, QtyReleased, QtyCompleted
          </p>

          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".csv"
              id="csv-file-input"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="csv-file-input" className="file-input-label">
              Choose CSV File
            </label>
            {fileName && <p className="file-name">Loaded: {fileName}</p>}
          </div>

          {/* Date Picker */}
          <div className="date-picker-section">
            <h3>Frozen Date Mode</h3>
            <p className="instructions">Analyze jobs as if it were any date:</p>
            <div className="date-picker-controls">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateInputChange}
                className="date-input"
              />
              <button onClick={handleApplyDate} className="apply-date-btn">
                Apply
              </button>
            </div>
            <p className="date-info">Current analysis date: {asOfDate.toDateString()}</p>
          </div>
        </section>

        {/* Right Section: Metrics & Table */}
        <section className="metrics-section">
          {jobs.length > 0 ? (
            <>
              {/* Metrics Cards */}
              <div className="metrics-grid">
                <MetricCard label="Total Jobs" value={metrics.total} color="neutral" />
                <MetricCard label="On Track" value={metrics.onTrack} color="green" />
                <MetricCard label="At Risk" value={metrics.atRisk} color="orange" />
                <MetricCard label="Late" value={metrics.late} color="red" />
              </div>

              {/* Filter Controls */}
              <div className="filter-controls">
                {/* Status Filter Buttons */}
                <div className="filter-group">
                  <label>Status:</label>
                  <div className="filter-buttons">
                    <button
                      className={`filter-button ${statusFilter === 'All' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('All')}
                    >
                      All
                    </button>
                    <button
                      className={`filter-button ${statusFilter === 'On Track' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('On Track')}
                    >
                      On Track
                    </button>
                    <button
                      className={`filter-button ${statusFilter === 'At Risk' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('At Risk')}
                    >
                      At Risk
                    </button>
                    <button
                      className={`filter-button ${statusFilter === 'Late' ? 'active' : ''}`}
                      onClick={() => setStatusFilter('Late')}
                    >
                      Late
                    </button>
                  </div>
                </div>

                {/* Work Center Filter Dropdown */}
                <div className="filter-group">
                  <label>Work Center:</label>
                  <select
                    className="filter-dropdown"
                    value={workCenterFilter}
                    onChange={(e) => setWorkCenterFilter(e.target.value)}
                  >
                    <option value="All">All Work Centers</option>
                    {workCenters.map((wc) => (
                      <option key={wc} value={wc}>
                        {wc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section Navigation Bar */}
              <SectionNavBar sections={sections} activeLabel={activeSection} />

              {/* Alerts Panel */}
              <div ref={alertsRef}>
                <AlertsPanel alerts={alerts} />
              </div>

              {/* Run List Panel */}
              <div ref={runListRef}>
                <RunListPanel runList={runList} />
              </div>

              {/* Load Summary Panel */}
              <div ref={loadSummaryRef}>
                <LoadSummaryPanel loadSummary={loadSummary} />
              </div>

              {/* Work Center Summary */}
              <div ref={bottlenecksRef}>
                {workCenterSummary.length > 0 && (
                  <div className="work-center-summary">
                    <h3>Work Center Bottlenecks</h3>
                    <div className="summary-cards">
                      {workCenterSummary.map((wc) => (
                        <div key={wc.workCenter} className="summary-card">
                          <div className="summary-label">{wc.workCenter}</div>
                          <div className="summary-stats">
                            <div className="summary-stat">
                              <span className="stat-label">Total</span>
                              <span className="stat-value">{wc.totalJobs}</span>
                            </div>
                            <div className="summary-stat">
                              <span className="stat-label">Late</span>
                              <span className="stat-value late">{wc.lateJobs}</span>
                            </div>
                            <div className="summary-stat">
                              <span className="stat-label">At Risk</span>
                              <span className="stat-value at-risk">{wc.atRiskJobs}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Jobs Table */}
              <div ref={jobsTableRef} className="table-wrapper">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('Job')} className="sortable">
                        Job {sortField === 'Job' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th>Part</th>
                      <th>Customer</th>
                      <th>WorkCenter</th>
                      <th>StartDate</th>
                      <th onClick={() => handleSort('DueDate')} className="sortable">
                        DueDate {sortField === 'DueDate' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th>QtyReleased</th>
                      <th>QtyCompleted</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Projected</th>
                      <th>Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedJobs.map((job, idx) => (
                      <tr key={idx}>
                        <td>{job.Job || '—'}</td>
                        <td>{job.Part || '—'}</td>
                        <td>{job.Customer || '—'}</td>
                        <td>{job.WorkCenter || '—'}</td>
                        <td>{job.StartDate || '—'}</td>
                        <td>{job.DueDate || '—'}</td>
                        <td>{job.QtyReleased || '—'}</td>
                        <td>{job.QtyCompleted || '—'}</td>
                        <td className="progress-cell">
                          {job.progress !== null ? (
                            <>
                              <ProgressBar value={job.progress} />
                              <span className="progress-text">
                                {(job.progress * 100).toFixed(0)}%
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusPill status={job.status} />
                        </td>
                        <td>
                          <div className="projected-cell">
                            <div className="projected-status">
                              {job.projectedStatus === 'Projected Late' && (
                                <span className="projected-late">Late</span>
                              )}
                              {job.projectedStatus === 'On Pace' && (
                                <span className="projected-on-pace">On Pace</span>
                              )}
                              {job.projectedStatus === 'Projected Early' && (
                                <span className="projected-early">Early</span>
                              )}
                              {job.projectedStatus === 'Unknown' && (
                                <span className="projected-unknown">Unknown</span>
                              )}
                            </div>
                            <div className="projected-date">
                              {job.projectedCompletionDate
                                ? job.projectedCompletionDate
                                    .toISOString()
                                    .split('T')[0]
                                : '—'}
                            </div>
                          </div>
                        </td>
                        <td className="timeline-cell">
                          <JobTimeline
                            startDate={parseDate(job.StartDate)}
                            dueDate={parseDate(job.DueDate)}
                            asOfDate={asOfDate}
                            projectedCompletionDate={job.projectedCompletionDate}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No jobs loaded. Upload a CSV to get started.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
