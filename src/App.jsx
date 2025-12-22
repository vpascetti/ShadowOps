import { useState, useMemo, useRef } from 'react'
import './App.css'
import StatusPill from './components/StatusPill'
import ProgressBar from './components/ProgressBar'
import MetricCard from './components/MetricCard'
import JobTimeline from './components/JobTimeline'
import AlertsPanel from './components/AlertsPanel'
import RunListPanel from './components/RunListPanel'
import LoadSummaryPanel from './components/LoadSummaryPanel'
import ExecutiveBriefing from './components/ExecutiveBriefing'
import DashboardView from './components/DashboardView'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse a date string (YYYY-MM-DD or other formats) and return a Date object at midnight local time
 * Ensures consistent date comparisons by zeroing out time component
 * @param {string} dateStr - Date string to parse
 * @returns {Date} - Date at midnight local time, or invalid date if unparseable
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN)
  
  // Try to parse as YYYY-MM-DD format first
  if (dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-') // Handle ISO format too
    if (parts.length === 3) {
      const [year, month, day] = parts
      // Create date at midnight LOCAL time
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0)
      return d
    }
  }
  
  // Fall back to standard Date constructor, but zero out time
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

// ============================================================================
// CALCULATION LOGIC
// ============================================================================

/**
 * Calculate job progress (QtyCompleted / QtyReleased)
 * Returns null if QtyReleased is 0 or missing
 */
function calculateProgress(qtyReleased, qtyCompleted) {
  const released = parseFloat(qtyReleased)
  const completed = parseFloat(qtyCompleted)
  
  if (!released || released === 0 || isNaN(completed)) {
    return null
  }
  
  return Math.min(completed / released, 1) // Cap at 100%
}

/**
 * Calculate schedule ratio: how far we are between StartDate and DueDate
 * Returns null if dates are invalid
 * 0 = at start date, 1 = at due date, >1 = past due date
 * @param {string} startDateStr - ISO date string or parseable date
 * @param {string} dueDateStr - ISO date string or parseable date
 * @param {Date} asOfDate - The "current" date to calculate from (defaults to today)
 */
function calculateScheduleRatio(startDateStr, dueDateStr, asOfDate = new Date()) {
  try {
    const startDate = parseDate(startDateStr)
    const dueDate = parseDate(dueDateStr)
    
    if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
      return null
    }
    
    const totalDuration = dueDate.getTime() - startDate.getTime()
    const elapsed = asOfDate.getTime() - startDate.getTime()
    
    if (totalDuration <= 0) {
      return null
    }
    
    return elapsed / totalDuration
  } catch (e) {
    return null
  }
}

/**
 * Determine job status based on progress and schedule
 * Returns one of: "Late", "At Risk", "On Track"
 * @param {string} dueDateStr - ISO date string or parseable date
 * @param {number|null} progress - Progress ratio (0-1) or null
 * @param {number|null} scheduleRatio - Schedule ratio (0-1) or null
 * @param {Date} asOfDate - The "current" date to evaluate against (defaults to today)
 */
function determineStatus(dueDateStr, progress, scheduleRatio, asOfDate = new Date()) {
  try {
    // Trim the due date string in case it has whitespace
    const dueDateTrimmed = (dueDateStr || '').trim()
    
    // Format asOfDate as YYYY-MM-DD string for comparison
    const asOfDateStr = `${asOfDate.getFullYear()}-${String(asOfDate.getMonth() + 1).padStart(2, '0')}-${String(asOfDate.getDate()).padStart(2, '0')}`
    
    // Simple string comparison works for YYYY-MM-DD format
    // Late: asOfDate > due date (as strings)
    if (asOfDateStr > dueDateTrimmed) {
      return 'Late'
    }
    
    // At Risk: schedule is >25% ahead of progress
    if (progress !== null && scheduleRatio !== null) {
      if (scheduleRatio - progress > 0.25) {
        return 'At Risk'
      }
    }
    
    return 'On Track'
  } catch (e) {
    return 'On Track'
  }
}

/**
 * Calculate projected completion date based on current progress and completion rate
 * @param {string} startDateStr - ISO date string for start date
 * @param {string} dueDateStr - ISO date string for due date
 * @param {Date} asOfDate - The "current" date to calculate from
 * @param {number|null} qtyReleased - Quantity released
 * @param {number|null} qtyCompleted - Quantity completed
 * @returns {Date|null} - Projected completion date or null if unable to calculate
 */
function calculateProjectedCompletionDate(
  startDateStr,
  dueDateStr,
  asOfDate,
  qtyReleased,
  qtyCompleted
) {
  try {
    const startDate = parseDate(startDateStr)
    const dueDate = parseDate(dueDateStr)
    const released = parseFloat(qtyReleased)
    const completed = parseFloat(qtyCompleted)

    // Validate inputs
    if (
      isNaN(startDate.getTime()) ||
      isNaN(dueDate.getTime()) ||
      isNaN(released) ||
      isNaN(completed) ||
      released <= 0
    ) {
      return null
    }

    // If asOfDate is before start date, we can't calculate yet
    if (asOfDate < startDate) {
      return null
    }

    // Calculate days elapsed
    const daysElapsed = Math.max(
      1,
      Math.floor((asOfDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    )

    // Calculate completion rate per day
    const completionRate = completed / daysElapsed

    // If no progress or invalid rate, return null
    if (completionRate <= 0 || completed <= 0) {
      return null
    }

    // Calculate remaining quantity
    const remainingQty = Math.max(0, released - completed)

    // If nothing remaining, projection is now
    if (remainingQty === 0) {
      return new Date(asOfDate.getTime())
    }

    // Calculate days remaining
    const daysRemaining = remainingQty / completionRate

    // Calculate projected completion date
    const projectedCompletionDate = new Date(
      asOfDate.getTime() + daysRemaining * (1000 * 60 * 60 * 24)
    )

    return projectedCompletionDate
  } catch (e) {
    return null
  }
}

/**
 * Determine projected status based on projected completion vs due date
 * @param {Date|null} projectedCompletionDate - Projected completion date or null
 * @param {Date} dueDate - Due date
 * @returns {string} - "Projected Late", "On Pace", "Projected Early", or "Unknown"
 */
function determineProjectedStatus(projectedCompletionDate, dueDate) {
  if (!projectedCompletionDate) {
    return 'Unknown'
  }

  try {
    // Allow small buffer for rounding (0.5 days = 12 hours)
    const bufferMs = 0.5 * 24 * 60 * 60 * 1000
    const earlyBufferMs = 2 * 24 * 60 * 60 * 1000 // 2 days early to be "Projected Early"

    if (projectedCompletionDate > new Date(dueDate.getTime() + bufferMs)) {
      return 'Projected Late'
    } else if (projectedCompletionDate < new Date(dueDate.getTime() - earlyBufferMs)) {
      return 'Projected Early'
    } else {
      return 'On Pace'
    }
  } catch (e) {
    return 'Unknown'
  }
}

/**
 * Calculate priority score for job prioritization
 * Higher score = higher priority to run
 * Factors: status (Late/At Risk), projected status, days until due, progress
 */
function calculatePriorityScore(job, asOfDate) {
  let score = 0

  // Critical: already late
  if (job.status === 'Late') {
    score += 100
  }

  // Warning: projected to be late
  if (job.projectedStatus === 'Projected Late') {
    score += 80
  }

  // At risk
  if (job.status === 'At Risk') {
    score += 50
  }

  // Days until due (sooner due date = higher priority)
  try {
    const dueDate = parseDate(job.DueDate)
    const daysToDue = Math.floor((dueDate.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24))
    score += Math.max(0, 30 - daysToDue) // Jobs due within 30 days get bonus
  } catch (e) {
    // If date parsing fails, no adjustment
  }

  // Small boost for jobs already partially done (helps finish them quickly)
  if (job.progress !== null) {
    score += job.progress * 20
  }

  return Math.max(0, score)
}

/**
 * Derive alerts from enriched jobs
 * Returns array of alert objects, sorted by severity and due date
 */
function deriveAlerts(jobs) {
  const alerts = []

  jobs.forEach((job) => {
    // Alert 1: Late Job (Critical)
    if (job.status === 'Late') {
      alerts.push({
        id: `late-${job.Job}`,
        severity: 'critical',
        title: `Job ${job.Job} is LATE`,
        description: `Due ${job.DueDate} on ${job.WorkCenter} (${job.Customer || 'N/A'})`,
        jobId: job.Job,
        workCenter: job.WorkCenter,
        dueDate: job.DueDate,
      })
    }

    // Alert 2: Projected Late (Warning)
    if (job.projectedStatus === 'Projected Late') {
      const projectedStr = job.projectedCompletionDate
        ? job.projectedCompletionDate.toISOString().split('T')[0]
        : 'Unknown'
      alerts.push({
        id: `proj-late-${job.Job}`,
        severity: 'warning',
        title: `Job ${job.Job} projected LATE`,
        description: `Projected ${projectedStr} > due ${job.DueDate}`,
        jobId: job.Job,
        workCenter: job.WorkCenter,
        dueDate: job.DueDate,
      })
    }

    // Alert 3: Behind Schedule / At Risk (Warning)
    if (job.status === 'At Risk') {
      const progressPct = job.progress !== null ? (job.progress * 100).toFixed(0) : '?'
      const schedulePct = job.scheduleRatio !== null ? (job.scheduleRatio * 100).toFixed(0) : '?'
      alerts.push({
        id: `at-risk-${job.Job}`,
        severity: 'warning',
        title: `Job ${job.Job} behind schedule`,
        description: `Progress ${progressPct}% vs ${schedulePct}% time elapsed`,
        jobId: job.Job,
        workCenter: job.WorkCenter,
        dueDate: job.DueDate,
      })
    }
  })

  // Sort: Critical first, then Warning, then by earliest due date
  alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, watch: 2 }
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return a.dueDate.localeCompare(b.dueDate)
  })

  // Return top 10 alerts to keep UI clean
  return alerts.slice(0, 10)
}

/**
 * Derive run list: prioritized jobs per work center
 * Returns array of { workCenter, jobs: [ ...sorted by priority ] }
 */
function deriveRunList(jobs, asOfDate) {
  // Group jobs by work center
  const jobsByWC = {}
  jobs.forEach((job) => {
    if (!jobsByWC[job.WorkCenter]) {
      jobsByWC[job.WorkCenter] = []
    }
    jobsByWC[job.WorkCenter].push(job)
  })

  // For each work center, add priority score and sort
  const runList = Object.keys(jobsByWC)
    .map((wc) => {
      const wcJobs = jobsByWC[wc].map((job) => ({
        ...job,
        priorityScore: calculatePriorityScore(job, asOfDate),
      }))
      // Sort by priority score descending
      wcJobs.sort((a, b) => b.priorityScore - a.priorityScore)
      return { workCenter: wc, jobs: wcJobs }
    })
    .filter((wc) => wc.jobs.length > 0)

  return runList
}

/**
 * Derive load summary: count of late/at-risk/projected-late jobs per work center
 * Returns array of { workCenter, totalJobs, lateJobs, projectedLateJobs, atRiskJobs, loadScore }
 */
function deriveLoadSummary(jobs) {
  const summaryByWC = {}

  jobs.forEach((job) => {
    if (!summaryByWC[job.WorkCenter]) {
      summaryByWC[job.WorkCenter] = {
        workCenter: job.WorkCenter,
        totalJobs: 0,
        lateJobs: 0,
        projectedLateJobs: 0,
        atRiskJobs: 0,
      }
    }

    const entry = summaryByWC[job.WorkCenter]
    entry.totalJobs += 1
    if (job.status === 'Late') entry.lateJobs += 1
    if (job.projectedStatus === 'Projected Late') entry.projectedLateJobs += 1
    if (job.status === 'At Risk') entry.atRiskJobs += 1
  })

  // Calculate load score and convert to array
  const summary = Object.values(summaryByWC).map((entry) => ({
    ...entry,
    loadScore: entry.lateJobs * 3 + entry.projectedLateJobs * 2 + entry.atRiskJobs * 1,
  }))

  // Sort by load score descending (highest load first)
  summary.sort((a, b) => b.loadScore - a.loadScore)

  return summary
}

/**
 * Enrich each job with calculated fields
 * @param {object} row - Raw job row from CSV
 * @param {Date} asOfDate - The "current" date to calculate from (defaults to today)
 */
function enrichJob(row, asOfDate = new Date()) {
  // Trim all string values to remove whitespace from CSV parsing
  const cleanRow = {}
  for (const key in row) {
    cleanRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key]
  }

  const progress = calculateProgress(cleanRow.QtyReleased, cleanRow.QtyCompleted)
  const scheduleRatio = calculateScheduleRatio(cleanRow.StartDate, cleanRow.DueDate, asOfDate)
  const status = determineStatus(cleanRow.DueDate, progress, scheduleRatio, asOfDate)

  // Calculate projected completion date and status
  const projectedCompletionDate = calculateProjectedCompletionDate(
    cleanRow.StartDate,
    cleanRow.DueDate,
    asOfDate,
    cleanRow.QtyReleased,
    cleanRow.QtyCompleted
  )
  const dueDate = parseDate(cleanRow.DueDate)
  const projectedStatus = determineProjectedStatus(projectedCompletionDate, dueDate)

  // Will calculate priority score in App component after all jobs are enriched
  return {
    ...cleanRow,
    progress,
    scheduleRatio,
    status,
    projectedCompletionDate,
    projectedStatus,
    priorityScore: 0, // Placeholder, calculated in useMemo
  }
}

/**
 * Calculate top-level metrics
 */
function calculateMetrics(jobs) {
  const total = jobs.length
  const late = jobs.filter(j => j.status === 'Late').length
  const atRisk = jobs.filter(j => j.status === 'At Risk').length
  const onTrack = jobs.filter(j => j.status === 'On Track').length
  
  return { total, late, atRisk, onTrack }
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [rawJobs, setRawJobs] = useState([]) // Store raw CSV rows
  const [selectedDate, setSelectedDate] = useState('') // Store date input value (YYYY-MM-DD format)
  const [asOfDate, setAsOfDate] = useState(new Date()) // The actual date used for calculations (defaults to today)
  const [fileName, setFileName] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [sortField, setSortField] = useState('Job')
  const [sortOrder, setSortOrder] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('All') // Filter by status: All | On Track | At Risk | Late
  const [workCenterFilter, setWorkCenterFilter] = useState('All') // Filter by work center
  const [viewMode, setViewMode] = useState('briefing') // 'dashboard' or 'briefing'

  // Format date for display (YYYY-MM-DD format)
  const formatDateForInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setUploadLoading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const uploadRes = await fetch('/api/upload-csv', {
        method: 'POST',
        body: fd,
      })

      let uploadJson = null
      let respText = ''
      try {
        respText = await uploadRes.text()
        try {
          uploadJson = respText ? JSON.parse(respText) : null
        } catch (parseErr) {
          console.error('Failed to parse upload response as JSON', parseErr, respText)
        }
      } catch (err) {
        console.error('Failed to read upload response text', err)
      }

      if (!uploadRes.ok) {
        const errMsg = uploadJson?.error || uploadJson?.message || respText || `HTTP ${uploadRes.status}`
        alert('Upload failed: ' + errMsg)
        return
      }

      if (!uploadJson || !uploadJson.ok) {
        const errMsg = uploadJson?.error || uploadJson?.message || respText || 'Unknown server response'
        alert('Upload failed: ' + errMsg)
        return
      }

      // Fetch jobs from backend
      const jobsRes = await fetch('/api/jobs')
      const jobsJson = await jobsRes.json()
      if (!jobsJson.ok) {
        alert('Failed fetching jobs from backend')
        return
      }

      // Map backend rows to frontend expected CSV keys
      const mapped = (jobsJson.jobs || []).map((r) => ({
        Job: r.job,
        Part: r.part,
        Customer: r.customer,
        WorkCenter: r.work_center,
        StartDate: r.start_date,
        DueDate: r.due_date,
        QtyReleased: r.qty_released,
        QtyCompleted: r.qty_completed,
      }))

      setRawJobs(mapped)

      // Reset date to today when new file is loaded
      const todayDate = new Date()
      const todayFormatted = formatDateForInput(todayDate)
      setAsOfDate(todayDate)
      setSelectedDate(todayFormatted)
    } catch (err) {
      console.error(err)
      alert('Error uploading file: ' + err.message)
    } finally {
      setUploadLoading(false)
    }
  }

  // Recompute jobs whenever rawJobs or asOfDate changes
  const jobs = useMemo(() => {
    const enrichedJobs = rawJobs.map(row => enrichJob(row, asOfDate))
    // Add priority scores to each job
    return enrichedJobs.map(job => ({
      ...job,
      priorityScore: calculatePriorityScore(job, asOfDate)
    }))
  }, [rawJobs, asOfDate])

  // Filter jobs based on status and work center filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const statusMatch = statusFilter === 'All' || job.status === statusFilter
      const workCenterMatch = workCenterFilter === 'All' || job.WorkCenter === workCenterFilter
      return statusMatch && workCenterMatch
    })
  }, [jobs, statusFilter, workCenterFilter])

  // Get unique work centers from all jobs
  const workCenters = useMemo(() => {
    const centers = new Set(jobs.map(job => job.WorkCenter).filter(Boolean))
    return Array.from(centers).sort()
  }, [jobs])

  // Compute work center summary (bottleneck analysis)
  const workCenterSummary = useMemo(() => {
    const summary = {}
    
    // Aggregate by work center
    jobs.forEach(job => {
      if (!job.WorkCenter) return
      
      if (!summary[job.WorkCenter]) {
        summary[job.WorkCenter] = {
          workCenter: job.WorkCenter,
          totalJobs: 0,
          lateJobs: 0,
          atRiskJobs: 0
        }
      }
      
      summary[job.WorkCenter].totalJobs++
      if (job.status === 'Late') summary[job.WorkCenter].lateJobs++
      if (job.status === 'At Risk') summary[job.WorkCenter].atRiskJobs++
    })
    
    // Convert to array and sort by late jobs (descending), then at risk, then total
    return Object.values(summary).sort((a, b) => {
      if (b.lateJobs !== a.lateJobs) return b.lateJobs - a.lateJobs
      if (b.atRiskJobs !== a.atRiskJobs) return b.atRiskJobs - a.atRiskJobs
      return b.totalJobs - a.totalJobs
    })
  }, [jobs])

  // Compute alerts from all jobs (not just filtered)
  const alerts = useMemo(() => {
    return deriveAlerts(jobs)
  }, [jobs])

  // Compute run list from all jobs (not just filtered)
  const runList = useMemo(() => {
    return deriveRunList(jobs, asOfDate)
  }, [jobs, asOfDate])

  // Compute load summary from all jobs (not just filtered)
  const loadSummary = useMemo(() => {
    return deriveLoadSummary(jobs)
  }, [jobs])

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Handle date input change (just update the input value, don't calculate yet)
  const handleDateInputChange = (e) => {
    setSelectedDate(e.target.value)
  }

  // Handle Apply button click (now calculate with the selected date)
  const handleApplyDate = () => {
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-')
      const newDate = new Date(year, parseInt(month) - 1, parseInt(day))
      setAsOfDate(newDate)
    }
  }

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    // Handle date sorting
    if (sortField === 'StartDate' || sortField === 'DueDate') {
      aVal = new Date(aVal).getTime() || 0
      bVal = new Date(bVal).getTime() || 0
    }
    // Handle numeric sorting
    else if (sortField === 'QtyReleased' || sortField === 'QtyCompleted') {
      aVal = parseFloat(aVal) || 0
      bVal = parseFloat(bVal) || 0
    }
    // String sorting
    else {
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const metrics = useMemo(() => calculateMetrics(filteredJobs), [filteredJobs])

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <div className="header-title">
              <h1 className="app-title">ShadowOps</h1>
              <p className="app-subtitle">Manufacturing Command Hub · v0.5</p>
            </div>
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'briefing' ? 'active' : ''}`}
                onClick={() => setViewMode('briefing')}
              >
                Executive Briefing
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
                onClick={() => setViewMode('dashboard')}
              >
                Operational Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {viewMode === 'briefing' ? (
        <ExecutiveBriefing
          metrics={metrics}
          alerts={alerts}
          runList={runList}
          loadSummary={loadSummary}
          asOfDate={asOfDate}
        />
      ) : (
        <DashboardView
          jobs={jobs}
          filteredJobs={filteredJobs}
          sortedJobs={sortedJobs}
          metrics={metrics}
          alerts={alerts}
          runList={runList}
          loadSummary={loadSummary}
          workCenterSummary={workCenterSummary}
          workCenters={workCenters}
          asOfDate={asOfDate}
          statusFilter={statusFilter}
          workCenterFilter={workCenterFilter}
          sortField={sortField}
          sortOrder={sortOrder}
          selectedDate={selectedDate}
          fileName={fileName}
          setStatusFilter={setStatusFilter}
          setWorkCenterFilter={setWorkCenterFilter}
          setSortField={setSortField}
          setSortOrder={setSortOrder}
          handleSort={handleSort}
          handleDateInputChange={handleDateInputChange}
          handleApplyDate={handleApplyDate}
          parseDate={parseDate}
          handleFileUpload={handleFileUpload}
          uploadLoading={uploadLoading}
        />
      )}
    </div>
  )
}

export default App
