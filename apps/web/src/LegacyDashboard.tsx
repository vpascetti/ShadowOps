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
// CENTRALIZED METRICS - ALL calculations must go through these functions
import {
  parseDate,
  calculateProgress,
  calculateScheduleRatio,
  determineStatus,
  getJobOrderValue,
  calculateMetrics,
  getJobPlant,
  derivePlantSummary,
  deriveWorkCenterSummary,
  logMetricsCalculation
} from './utils/metricsCalculations'

// ============================================================================
// HELPER FUNCTIONS - All metric calculations are now in utils/metricsCalculations.ts
// ============================================================================

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

// ============================================================================
// MAIN APP
// ============================================================================

export default function LegacyDashboard({ onExit, currentView = 'briefing', onViewChange }) {
  const [rawJobs, setRawJobs] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [asOfDate, setAsOfDate] = useState(new Date())
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [sortField, setSortField] = useState('Job')
  const [sortOrder, setSortOrder] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [workCenterFilter, setWorkCenterFilter] = useState('All')
  const [plantFilter, setPlantFilter] = useState('All')
  const [dataSource, setDataSource] = useState('API')
  const [apiError, setApiError] = useState(null)
  const [realtimeData, setRealtimeData] = useState([])
  const [realtimeError, setRealtimeError] = useState(null)
  
  const viewMode = currentView  // Map currentView to viewMode for existing logic

  const formatDateForInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadJobsFromApi = async (sourceLabel = 'API', fileLabel = 'API: Canonical Provider') => {
    setDataSource(sourceLabel)
    setApiError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/demo/jobs')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'API error')
      }
      const data = await res.json()
      const jobs = Array.isArray(data.jobs) ? data.jobs : []
      // OPTIMIZATION: Use work_center directly from API response instead of N+1 queries
      const mapped = jobs.map((r) => ({
        Job: r.Job || r.job_id,
        Part: r.Part || r.part || '',
        Customer: r.Customer || r.customer || '',
        WorkCenter: r.WorkCenter || r.work_center || '',
        Plant: r.Plant || r.plant_name || r.eplant_company || (r.eplant_id ? `Plant ${r.eplant_id}` : ''),
        StartDate: r.StartDate || r.start_date || '',
        DueDate: r.DueDate || r.due_date,
        QtyReleased: r.QtyReleased || r.qty_released || '',
        QtyCompleted: r.QtyCompleted || r.qty_completed || '',
        description: r.description || '',
        risk_score: r.risk_score || 0,
        total_order_value: r.total_order_value || r.TotalOrderValue || r.totalOrderValue || '',
        unit_price: r.unit_price || r.UnitPrice || r.unitPrice || '',
        plant_id: r.plant_id || r.eplant_id || '',
        eplant_id: r.eplant_id || r.plant_id || '',
        eplant_company: r.eplant_company || r.plant_name || '',
        material_exception: r.material_exception || false,
        MaterialShortage: r.MaterialShortage || r.material_shortage || false,
        MaterialItem: r.MaterialItem || r.material_item || '',
        MaterialRequiredQty: r.MaterialRequiredQty || r.material_required_qty || 0,
        MaterialIssuedQty: r.MaterialIssuedQty || r.material_issued_qty || 0,
        MaterialShortQty: r.MaterialShortQty || r.material_short_qty || 0
      }))
      setRawJobs(mapped)
      setFileName(fileLabel)
    } catch (err) {
      setApiError(err.message)
      setRawJobs([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadRealtimeFromApi = async () => {
    setRealtimeError(null)
    try {
      const res = await fetch('/realtime/part-numbers')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Realtime API error')
      }
      const payload = await res.json()
      setRealtimeData(Array.isArray(payload.data) ? payload.data : [])
    } catch (err) {
      setRealtimeError(err.message)
      setRealtimeData([])
    }
  }

  useEffect(() => {
    // Load initial data on mount
    loadJobsFromApi('API', 'API: Canonical Provider')
    loadRealtimeFromApi()
  }, [])

  useEffect(() => {
    // Reload data when switching views to ensure it's always available
    if ((viewMode === 'dashboard' || viewMode === 'briefing' || viewMode === 'actions') && rawJobs.length === 0) {
      loadJobsFromApi('API', 'API: Canonical Provider')
      loadRealtimeFromApi()
    }
  }, [viewMode, rawJobs.length])



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
      const plantValue = getJobPlant(job)
      const plantMatch = plantFilter === 'All' || plantValue === plantFilter
      return statusMatch && workCenterMatch && plantMatch
    })
  }, [jobs, statusFilter, workCenterFilter, plantFilter])

  const workCenters = useMemo(() => {
    const centers = new Set(jobs.map((job) => job.WorkCenter).filter(Boolean))
    return Array.from(centers).sort()
  }, [jobs])

  const plants = useMemo(() => {
    const unique = new Set(jobs.map((job) => getJobPlant(job)).filter(Boolean))
    return Array.from(unique).sort()
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

  const plantSummary = useMemo(() => derivePlantSummary(filteredJobs), [filteredJobs])

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
  const overviewMetrics = useMemo(() => calculateMetrics(jobs), [jobs])

  return (
    <div className="app">
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Loading jobs...</div>
          <div style={{ color: '#666' }}>Fetching data from IQMS</div>
        </div>
      )}
      {apiError && (
        <div style={{
          background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '1.5rem',
          margin: '1rem',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
        }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#991b1b', marginBottom: '0.5rem' }}>
            ⚠️ Unable to Load Jobs
          </div>
          <div style={{ color: '#7f1d1d', marginBottom: '1rem' }}>
            {apiError.includes('fetch') || apiError.includes('network') 
              ? 'Network connection failed. Please check your connection and try again.'
              : apiError.includes('API error')
              ? 'The IQMS service is temporarily unavailable. Please try again in a moment.'
              : `Error: ${apiError}`}
          </div>
          <button
            onClick={() => loadJobsFromApi('API', 'API: Canonical Provider')}
            style={{
              background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {viewMode === 'briefing' ? (
        <>
          <ExecutiveBriefing
            metrics={overviewMetrics}
            alerts={alerts}
            runList={runList}
            loadSummary={loadSummary}
            asOfDate={asOfDate}
            jobs={jobs}
            dataSource={dataSource}
          />
        </>
      ) : viewMode === 'actions' ? (
        <SuggestedActionsPanel jobs={jobs} />
      ) : (
        <DashboardView
          jobs={jobs}
          filteredJobs={filteredJobs}
          sortedJobs={sortedJobs}
          metrics={metrics}
          alerts={alerts}
          runList={runList}
          loadSummary={loadSummary}
          plantSummary={plantSummary}
          workCenterSummary={workCenterSummary}
          workCenters={workCenters}
          plants={plants}
          asOfDate={asOfDate}
          statusFilter={statusFilter}
          workCenterFilter={workCenterFilter}
          plantFilter={plantFilter}
          sortField={sortField}
          sortOrder={sortOrder}
          selectedDate={selectedDate}
          fileName={fileName}
          setStatusFilter={setStatusFilter}
          setWorkCenterFilter={setWorkCenterFilter}
          setPlantFilter={setPlantFilter}
          setSortField={setSortField}
          setSortOrder={setSortOrder}
          handleSort={handleSort}
          handleDateInputChange={handleDateInputChange}
          handleApplyDate={handleApplyDate}
          parseDate={parseDate}
        />
      )}
    </div>
  )
}
