// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import './legacy-dashboard.css'
import StatusPill from './components/StatusPill'
import ProgressBar from './components/ProgressBar'
import MetricCard from './components/MetricCard'
import JobTimeline from './components/JobTimeline'
import AlertsPanel from './components/AlertsPanel'
import RunListPanel from './components/RunListPanel'
import LoadSummaryPanel from './components/LoadSummaryPanel'
import SuggestedActionsPanel from './components/SuggestedActionsPanel'
import MachineHealthPanel from './components/MachineHealthPanel'
import ExecutiveBriefing from './components/ExecutiveBriefing'
import DashboardView from './components/DashboardView'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDate(dateStr) {
  if (!dateStr) return new Date(NaN)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const [year, month, day] = parts
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0)
    }
  }
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

function calculateProgress(qtyReleased, qtyCompleted) {
  const released = parseFloat(qtyReleased)
  const completed = parseFloat(qtyCompleted)
  if (!released || released === 0 || isNaN(completed)) {
    return null
  }
  return Math.min(completed / released, 1)
}

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
  } catch (_e) {
    return null
  }
}

function determineStatus(dueDateStr, progress, scheduleRatio, asOfDate = new Date()) {
  try {
    const dueDateTrimmed = (dueDateStr || '').trim()
    const asOfDateStr = `${asOfDate.getFullYear()}-${String(asOfDate.getMonth() + 1).padStart(2, '0')}-${String(asOfDate.getDate()).padStart(2, '0')}`
    if (asOfDateStr > dueDateTrimmed) {
      return 'Late'
    }
    if (progress !== null && scheduleRatio !== null) {
      if (scheduleRatio - progress > 0.25) {
        return 'At Risk'
      }
    }
    return 'On Track'
  } catch (_e) {
    return 'On Track'
  }
}

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

    if (
      isNaN(startDate.getTime()) ||
      isNaN(dueDate.getTime()) ||
      isNaN(released) ||
      isNaN(completed) ||
      released <= 0
    ) {
      return null
    }

    if (asOfDate < startDate) {
      return null
    }

    const daysElapsed = Math.max(
      1,
      Math.floor((asOfDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    )

    const completionRate = completed / daysElapsed

    if (completionRate <= 0 || completed <= 0) {
      return null
    }

    const remainingQty = Math.max(0, released - completed)

    if (remainingQty === 0) {
      return new Date(asOfDate.getTime())
    }

    const daysRemaining = remainingQty / completionRate

    return new Date(asOfDate.getTime() + daysRemaining * (1000 * 60 * 60 * 24))
  } catch (_e) {
    return null
  }
}

function determineProjectedStatus(projectedCompletionDate, dueDate) {
  if (!projectedCompletionDate) {
    return 'Unknown'
  }

  try {
    const bufferMs = 0.5 * 24 * 60 * 60 * 1000
    const earlyBufferMs = 2 * 24 * 60 * 60 * 1000

    if (projectedCompletionDate > new Date(dueDate.getTime() + bufferMs)) {
      return 'Projected Late'
    }
    if (projectedCompletionDate < new Date(dueDate.getTime() - earlyBufferMs)) {
      return 'Projected Early'
    }
    return 'On Pace'
  } catch (_e) {
    return 'Unknown'
  }
}

function calculatePriorityScore(job, asOfDate) {
  let score = 0
  if (job.status === 'Late') {
    score += 60
  }
  if (job.projectedStatus === 'Projected Late') {
    score += 40
  }
  if (job.status === 'At Risk') {
    score += 30
  }

  try {
    const dueDate = parseDate(job.DueDate)
    const daysToDue = Math.floor((dueDate.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24))
    score += Math.max(0, Math.min(20, 20 - daysToDue))
  } catch (_e) {
    // ignore
  }

  if (job.progress !== null) {
    score += job.progress * 10
  }

  return Math.max(0, score)
}

function deriveAlerts(jobs) {
  const alerts = []

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = date.getFullYear()
      return `${month}-${day}-${year}`
    } catch (_e) {
      return dateStr
    }
  }

  jobs.forEach((job) => {
    if (job.status === 'Late') {
      alerts.push({
        id: `late-${job.Job}`,
        severity: 'critical',
        title: `Job ${job.Job} is LATE`,
        description: `Due ${formatDate(job.DueDate)} on ${job.WorkCenter || 'N/A'} (${job.Customer || 'N/A'})`,
        jobId: job.Job,
        workCenter: job.WorkCenter,
        dueDate: job.DueDate
      })
    }

    if (job.projectedStatus === 'Projected Late') {
      const projectedStr = job.projectedCompletionDate
        ? formatDate(job.projectedCompletionDate.toISOString())
        : 'Unknown'
      alerts.push({
        id: `proj-late-${job.Job}`,
        severity: 'warning',
        title: `Job ${job.Job} projected LATE`,
        description: `Projected ${projectedStr} > due ${formatDate(job.DueDate)}`,
        jobId: job.Job,
        workCenter: job.WorkCenter,
        dueDate: job.DueDate
      })
    }

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
        dueDate: job.DueDate
      })
    }
  })

  alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, watch: 2 }
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
  })

  return alerts.slice(0, 10)
}

function deriveRunList(jobs) {
  const jobsByWC = {}
  jobs.forEach((job) => {
    const key = job.WorkCenter || 'Unassigned'
    if (!jobsByWC[key]) {
      jobsByWC[key] = []
    }
    jobsByWC[key].push(job)
  })

  const runList = Object.keys(jobsByWC)
    .map((wc) => {
      const wcJobs = jobsByWC[wc]
      wcJobs.sort((a, b) => b.priorityScore - a.priorityScore)
      return { workCenter: wc, jobs: wcJobs }
    })
    .filter((wc) => wc.jobs.length > 0)

  return runList
}

function deriveLoadSummary(jobs) {
  const summaryByWC = {}

  jobs.forEach((job) => {
    const key = job.WorkCenter || 'Unassigned'
    if (!summaryByWC[key]) {
      summaryByWC[key] = {
        workCenter: key,
        totalJobs: 0,
        lateJobs: 0,
        projectedLateJobs: 0,
        atRiskJobs: 0
      }
    }

    const entry = summaryByWC[key]
    entry.totalJobs += 1
    if (job.status === 'Late') entry.lateJobs += 1
    if (job.projectedStatus === 'Projected Late') entry.projectedLateJobs += 1
    if (job.status === 'At Risk') entry.atRiskJobs += 1
  })

  const summary = Object.values(summaryByWC).map((entry) => ({
    ...entry,
    loadScore: entry.lateJobs * 3 + entry.projectedLateJobs * 2 + entry.atRiskJobs * 1
  }))

  summary.sort((a, b) => b.loadScore - a.loadScore)
  return summary
}

function enrichJob(row, asOfDate = new Date()) {
  const cleanRow = {}
  for (const key in row) {
    cleanRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key]
  }

  const progress = calculateProgress(cleanRow.QtyReleased, cleanRow.QtyCompleted)
  const scheduleRatio = calculateScheduleRatio(cleanRow.StartDate, cleanRow.DueDate, asOfDate)
  const status = determineStatus(cleanRow.DueDate, progress, scheduleRatio, asOfDate)

  const projectedCompletionDate = calculateProjectedCompletionDate(
    cleanRow.StartDate,
    cleanRow.DueDate,
    asOfDate,
    cleanRow.QtyReleased,
    cleanRow.QtyCompleted
  )
  const dueDate = parseDate(cleanRow.DueDate)
  const projectedStatus = determineProjectedStatus(projectedCompletionDate, dueDate)

  return {
    ...cleanRow,
    progress,
    scheduleRatio,
    status,
    projectedCompletionDate,
    projectedStatus,
    priorityScore: 0
  }
}

function calculateMetrics(jobs) {
  const total = jobs.length
  const late = jobs.filter((j) => j.status === 'Late').length
  const atRisk = jobs.filter((j) => j.status === 'At Risk').length
  const onTrack = jobs.filter((j) => j.status === 'On Track').length

  return { total, late, atRisk, onTrack }
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function LegacyDashboard({ onExit }) {
  const [rawJobs, setRawJobs] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [asOfDate, setAsOfDate] = useState(new Date())
  const [fileName, setFileName] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [sortField, setSortField] = useState('Job')
  const [sortOrder, setSortOrder] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [workCenterFilter, setWorkCenterFilter] = useState('All')
  const [viewMode, setViewMode] = useState('briefing')
  const [dataSource, setDataSource] = useState('API')
  const [apiError, setApiError] = useState(null)

  const formatDateForInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadJobsFromApi = async (sourceLabel = 'API', fileLabel = 'API: Canonical Provider') => {
    setDataSource(sourceLabel)
    setApiError(null)
    try {
      const res = await fetch('/jobs')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'API error')
      }
      const data = await res.json()
      const jobs = Array.isArray(data.jobs) ? data.jobs : []
      const mapped = await Promise.all(
        jobs.map(async (r) => {
          let workCenter = ''
          try {
            const detailRes = await fetch(`/jobs/${r.job_id}`)
            const detailJson = await detailRes.json()
            const op = detailJson.operations?.[0]
            workCenter = op?.resource_id || ''
          } catch (_e) {
            workCenter = ''
          }

          return {
            Job: r.job_id,
            WorkCenter: workCenter,
            StartDate: r.start_date || '',
            DueDate: r.due_date,
            QtyReleased: r.qty_released || '',
            QtyCompleted: r.qty_completed || ''
          }
        })
      )
      setRawJobs(mapped)
      setFileName(fileLabel)
    } catch (err) {
      setApiError(err.message)
      setRawJobs([])
    }
  }

  useEffect(() => {
    if (viewMode === 'dashboard') {
      loadJobsFromApi('API', 'API: Canonical Provider')
    }
  }, [viewMode])

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadLoading(true)
    setApiError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/upload-csv', {
        method: 'POST',
        body: formData
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Upload failed')
      }

      await loadJobsFromApi('CSV Upload', file.name)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setUploadLoading(false)
      event.target.value = ''
    }
  }

  const jobs = useMemo(() => {
    const enrichedJobs = rawJobs.map((row) => enrichJob(row, asOfDate))
    const jobsWithRawScores = enrichedJobs.map((job) => ({
      ...job,
      rawPriorityScore: calculatePriorityScore(job, asOfDate)
    }))

    jobsWithRawScores.sort((a, b) => b.rawPriorityScore - a.rawPriorityScore)
    const totalJobs = jobsWithRawScores.length
    return jobsWithRawScores.map((job, index) => {
      const priorityScore = Math.max(1, Math.round(100 - (index / totalJobs) * 100))
      return {
        ...job,
        priorityScore
      }
    })
  }, [rawJobs, asOfDate])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const statusMatch = statusFilter === 'All' || job.status === statusFilter
      const workCenterMatch = workCenterFilter === 'All' || job.WorkCenter === workCenterFilter
      return statusMatch && workCenterMatch
    })
  }, [jobs, statusFilter, workCenterFilter])

  const workCenters = useMemo(() => {
    const centers = new Set(jobs.map((job) => job.WorkCenter).filter(Boolean))
    return Array.from(centers).sort()
  }, [jobs])

  const workCenterSummary = useMemo(() => {
    const summary = {}

    filteredJobs.forEach((job) => {
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

    return Object.values(summary).sort((a, b) => {
      if (b.lateJobs !== a.lateJobs) return b.lateJobs - a.lateJobs
      if (b.atRiskJobs !== a.atRiskJobs) return b.atRiskJobs - a.atRiskJobs
      return b.totalJobs - a.totalJobs
    })
  }, [filteredJobs])

  const alerts = useMemo(() => deriveAlerts(filteredJobs), [filteredJobs])
  const runList = useMemo(() => deriveRunList(filteredJobs), [filteredJobs])
  const loadSummary = useMemo(() => deriveLoadSummary(filteredJobs), [filteredJobs])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleDateInputChange = (e) => {
    setSelectedDate(e.target.value)
  }

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

    if (sortField === 'StartDate' || sortField === 'DueDate') {
      aVal = new Date(aVal).getTime() || 0
      bVal = new Date(bVal).getTime() || 0
    } else if (sortField === 'QtyReleased' || sortField === 'QtyCompleted') {
      aVal = parseFloat(aVal) || 0
      bVal = parseFloat(bVal) || 0
    } else {
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
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <div className="header-title">
              <h1 className="app-title">ShadowOps</h1>
              <p className="app-subtitle">Manufacturing Command Hub · Legacy View</p>
            </div>
            <div className="view-toggle">
              <button className="view-toggle-btn" onClick={onExit}>
                Back to Phase 1
              </button>
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
            <div className="data-source-label" style={{ marginLeft: 24, fontWeight: 500, color: '#2b7' }}>
              Data Source: {dataSource}
            </div>
          </div>
        </div>
      </header>

      {apiError && (
        <div style={{ color: 'red', fontWeight: 600, margin: '1em' }}>
          Error loading jobs from API: {apiError}
        </div>
      )}

      {viewMode === 'briefing' ? (
        <>
          <ExecutiveBriefing
            metrics={metrics}
            alerts={alerts}
            runList={runList}
            loadSummary={loadSummary}
            asOfDate={asOfDate}
          />
          <MachineHealthPanel jobs={jobs} />
          <SuggestedActionsPanel jobs={jobs} />
        </>
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
