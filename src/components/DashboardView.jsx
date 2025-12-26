import { useRef, useState, useEffect } from 'react';
import StatusPill from './StatusPill';
import ProgressBar from './ProgressBar';
import MetricCard from './MetricCard';
import JobTimeline from './JobTimeline';
import AlertsPanel from './AlertsPanel';
import RunListPanel from './RunListPanel';
import LoadSummaryPanel from './LoadSummaryPanel';
import MaterialShortagePanel from './MaterialShortagePanel';
import SectionNavBar from './SectionNavBar';
import '../styles/DashboardView.css';

// Helper function to generate reason text for job status
function getJobReason(job, asOfDate) {
  if (job.status === 'Late') {
    return `Past due date (${formatDate(job.DueDate)})`;
  }
  
  if (job.status === 'At Risk') {
    const progressPct = job.progress !== null ? (job.progress * 100).toFixed(0) : '?';
    const schedulePct = job.scheduleRatio !== null ? (job.scheduleRatio * 100).toFixed(0) : '?';
    return `${progressPct}% done, ${schedulePct}% time elapsed`;
  }
  
  if (job.projectedStatus === 'Projected Late' && job.status !== 'Late') {
    return 'Current pace projects late completion';
  }
  
  return '—';
}

// Helper function to determine root cause and accountability
function getRootCauseAndAccountability(job, asOfDate) {
  const progress = job.progress !== null ? job.progress : 0;
  const scheduleRatio = job.scheduleRatio !== null ? job.scheduleRatio : 0;
  
  // Calculate days until due
  let daysUntilDue = 0;
  try {
    const dueDate = new Date(job.DueDate);
    daysUntilDue = Math.floor((dueDate - asOfDate) / (1000 * 60 * 60 * 24));
  } catch (e) {
    daysUntilDue = 0;
  }
  
  // Check if this looks like a material shortage (low/no progress despite time elapsed)
  const likelyMaterialShortage = progress < 0.1 && scheduleRatio > 0.2;
  
  // Already late
  if (job.status === 'Late') {
    if (progress === 0) {
      // No progress at all - check if it's material or planning issue
      if (scheduleRatio > 0.3) {
        return {
          issue: 'Material Shortage',
          responsible: 'Procurement',
          action: 'Expedite material orders immediately'
        };
      }
      return {
        issue: 'Not Started',
        responsible: 'Production Supervisor',
        action: 'Expedite job release and staffing'
      };
    } else if (progress < 0.3) {
      if (likelyMaterialShortage) {
        return {
          issue: 'Material Shortage',
          responsible: 'Procurement',
          action: 'Critical material needed ASAP'
        };
      }
      return {
        issue: 'Minimal Progress',
        responsible: 'Production Supervisor',
        action: 'Review capacity and prioritize'
      };
    } else {
      return {
        issue: 'Slow Completion Rate',
        responsible: 'Production Supervisor',
        action: 'Add resources or overtime'
      };
    }
  }
  
  // At Risk - behind schedule
  if (job.status === 'At Risk') {
    const gap = scheduleRatio - progress;
    
    if (progress === 0) {
      // No progress - likely material or release delay
      if (scheduleRatio > 0.15) {
        return {
          issue: 'Material Shortage',
          responsible: 'Procurement',
          action: 'Verify material delivery status'
        };
      }
      return {
        issue: 'Delayed Start',
        responsible: 'Production Planner',
        action: 'Investigate release delays'
      };
    } else if (likelyMaterialShortage) {
      return {
        issue: 'Material Shortage',
        responsible: 'Procurement',
        action: 'Expedite material availability'
      };
    } else if (gap > 0.5) {
      return {
        issue: 'Severe Schedule Slip',
        responsible: 'Production Manager',
        action: 'Immediate intervention required'
      };
    } else if (progress < 0.5 && daysUntilDue < 7) {
      return {
        issue: 'Material Risk',
        responsible: 'Procurement/Inventory',
        action: 'Verify material for completion'
      };
    } else {
      return {
        issue: 'Below Target Pace',
        responsible: 'Production Supervisor',
        action: 'Increase throughput'
      };
    }
  }
  
  // Projected Late but currently on track
  if (job.projectedStatus === 'Projected Late' && job.status !== 'Late') {
    if (likelyMaterialShortage) {
      return {
        issue: 'Material Shortage',
        responsible: 'Procurement',
        action: 'Material needed for acceleration'
      };
    } else if (progress < 0.3) {
      return {
        issue: 'Slow Initial Progress',
        responsible: 'Production Supervisor',
        action: 'Accelerate completion rate'
      };
    } else {
      return {
        issue: 'Insufficient Velocity',
        responsible: 'Production Supervisor',
        action: 'Improve daily output'
      };
    }
  }
  
  // On track - no issues
  return {
    issue: '—',
    responsible: '—',
    action: '—'
  };
}

// Helper function to format dates as MM-DD-YYYY
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return original if invalid
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

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
  uploadLoading,
}) {
  // Create refs for section navigation
  const alertsRef = useRef(null);
  const runListRef = useRef(null);
  const loadSummaryRef = useRef(null);
  const materialShortageRef = useRef(null);
  const jobsTableRef = useRef(null);

  // Define default column order
  const defaultColumns = [
    { id: 'Job', label: 'Job', sortable: true },
    { id: 'Part', label: 'Part', sortable: false },
    { id: 'Customer', label: 'Customer', sortable: false },
    { id: 'WorkCenter', label: 'WorkCenter', sortable: false },
    { id: 'StartDate', label: 'StartDate', sortable: false },
    { id: 'DueDate', label: 'DueDate', sortable: true },
    { id: 'QtyReleased', label: 'QtyReleased', sortable: false },
    { id: 'QtyCompleted', label: 'QtyCompleted', sortable: false },
    { id: 'Progress', label: 'Progress', sortable: false },
    { id: 'Status', label: 'Status', sortable: false },
    { id: 'Reason', label: 'Reason', sortable: false },
    { id: 'RootCause', label: 'Root Cause', sortable: false },
    { id: 'Accountable', label: 'Accountable', sortable: false },
    { id: 'Projected', label: 'Projected', sortable: false },
    { id: 'Timeline', label: 'Timeline', sortable: false },
  ];

  // State for column order and dragging
  const [columnOrder, setColumnOrder] = useState(defaultColumns);
  const [draggedColumn, setDraggedColumn] = useState(null);
  
  // Drag handlers
  const handleDragStart = (e, index) => {
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === index) return;
    
    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedColumn];
    newOrder.splice(draggedColumn, 1);
    newOrder.splice(index, 0, draggedItem);
    
    setColumnOrder(newOrder);
    setDraggedColumn(index);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Function to render cell content based on column ID
  const renderCell = (columnId, job) => {
    switch (columnId) {
      case 'Job':
        return job.Job || '—';
      case 'Part':
        return job.Part || '—';
      case 'Customer':
        return job.Customer || '—';
      case 'WorkCenter':
        return job.WorkCenter || '—';
      case 'StartDate':
        return formatDate(job.StartDate);
      case 'DueDate':
        return formatDate(job.DueDate);
      case 'QtyReleased':
        return job.QtyReleased || '—';
      case 'QtyCompleted':
        return job.QtyCompleted || '—';
      case 'Progress':
        return (
          <div className="progress-cell">
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
          </div>
        );
      case 'Status':
        return <StatusPill status={job.status} />;
      case 'Reason':
        return (
          <div className="reason-cell">
            <span className="reason-text">{getJobReason(job, asOfDate)}</span>
          </div>
        );
      case 'RootCause':
        return (
          <div className="root-cause-cell">
            <span className="issue-text">{getRootCauseAndAccountability(job, asOfDate).issue}</span>
          </div>
        );
      case 'Accountable':
        return (
          <div className="accountability-cell">
            <div className="accountability-info">
              <div className="responsible">{getRootCauseAndAccountability(job, asOfDate).responsible}</div>
              <div className="action-needed">{getRootCauseAndAccountability(job, asOfDate).action}</div>
            </div>
          </div>
        );
      case 'Projected':
        return (
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
        );
      case 'Timeline':
        return (
          <div className="timeline-cell">
            <JobTimeline
              startDate={parseDate(job.StartDate)}
              dueDate={parseDate(job.DueDate)}
              projectedDate={job.projectedCompletionDate}
              asOfDate={asOfDate}
            />
          </div>
        );
      default:
        return '—';
    }
  };

  const sections = [
    { label: 'Alerts', ref: alertsRef },
    { label: 'Run List', ref: runListRef },
    { label: 'Load Summary', ref: loadSummaryRef },
    { label: 'Material Shortages', ref: materialShortageRef },
    { label: 'Jobs Table', ref: jobsTableRef },
  ];

  const [activeSection, setActiveSection] = useState('Alerts');

  useEffect(() => {
    const refs = [alertsRef, runListRef, loadSummaryRef, materialShortageRef, jobsTableRef];
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
              disabled={uploadLoading}
            />
            <label
              htmlFor="csv-file-input"
              className={`file-input-label ${uploadLoading ? 'loading' : ''}`}
            >
              {uploadLoading ? 'Uploading…' : 'Choose CSV File'}
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
                <MetricCard 
                  label="Total Jobs" 
                  value={metrics.total} 
                  color="neutral" 
                  tooltip="Total number of jobs in the current filter"
                />
                <MetricCard 
                  label="On Track" 
                  value={metrics.onTrack} 
                  color="green" 
                  tooltip="Jobs progressing on schedule to meet their due date"
                />
                <MetricCard 
                  label="At Risk" 
                  value={metrics.atRisk} 
                  color="orange" 
                  tooltip="Jobs behind schedule (progress < time elapsed)"
                />
                <MetricCard 
                  label="Late" 
                  value={metrics.late} 
                  color="red" 
                  tooltip="Jobs past their due date"
                />
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
              <section ref={alertsRef}>
                <AlertsPanel alerts={alerts} />
              </section>

              {/* Run List Panel */}
              <section ref={runListRef}>
                <RunListPanel runList={runList} />
              </section>

              {/* Load Summary Panel */}
              <section ref={loadSummaryRef}>
                <LoadSummaryPanel loadSummary={loadSummary} />
              </section>

              {/* Material Shortages Panel */}
              <section ref={materialShortageRef}>
                <MaterialShortagePanel jobs={filteredJobs} />
              </section>

              {/* Jobs Table */}
              <section ref={jobsTableRef} className="table-wrapper">
                <div className="column-reorder-hint">💡 Drag column headers to reorder</div>
                <table className="jobs-table">
                  <thead>
                    <tr>
                      {columnOrder.map((column, index) => (
                        <th
                          key={column.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => column.sortable && handleSort(column.id)}
                          className={`${column.sortable ? 'sortable' : ''} ${draggedColumn === index ? 'dragging' : ''}`}
                          style={{ cursor: 'move' }}
                        >
                          {column.label} {column.sortable && sortField === column.id && (sortOrder === 'asc' ? '▲' : '▼')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedJobs.map((job, idx) => (
                      <tr key={idx}>
                        {columnOrder.map((column) => (
                          <td key={column.id}>
                            {renderCell(column.id, job)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
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
