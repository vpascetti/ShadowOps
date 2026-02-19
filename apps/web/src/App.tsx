import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import './App.css'
import LegacyDashboard from './LegacyDashboard'
import FinancialSummary from './components/FinancialSummary'
import PlantPulse from './components/PlantPulse'
import UnifiedHeader from './components/UnifiedHeader'

type Job = {
  job_id: string
  due_date: string
  priority?: number
  status: string
  remaining_work: number
  risk_score: number
  risk_reason?: string
}

type JobDetail = {
  job: Job
  operations: Array<{
    operation_id: string
    resource_id: string
    sequence: number
    standard_rate: number
    actual_rate: number
    remaining_time: number
  }>
}

type MetricsSummary = {
  atRiskCount: number
  dueNext7Days: number
  overloadedResourcesCount: number
}

const buildQuery = (params: Record<string, string>) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

export default function App() {
  const [view, setView] = useState<'phase1' | 'legacy' | 'financial' | 'plant-pulse' | 'briefing' | 'dashboard' | 'actions'>('briefing')
  const [jobs, setJobs] = useState<Job[]>([])
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)

  const [statusFilter, setStatusFilter] = useState('')
  const [dueStart, setDueStart] = useState('')
  const [dueEnd, setDueEnd] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')

  const handleViewChange = (newView: string) => {
    setView(newView as any)
  }

  const queryString = useMemo(
    () =>
      buildQuery({
        status: statusFilter,
        dueDateStart: dueStart,
        dueDateEnd: dueEnd,
        resourceId: resourceFilter
      }),
    [statusFilter, dueStart, dueEnd, resourceFilter]
  )

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [jobsRes, metricsRes] = await Promise.all([
          fetch(`/jobs${queryString}`),
          fetch('/metrics/summary')
        ])
        const jobsPayload = await jobsRes.json()
        const metricsPayload = await metricsRes.json()

        if (!ignore) {
          setJobs(jobsPayload.jobs || [])
          setMetrics(metricsPayload.metrics || null)
        }
      } catch (err) {
        if (!ignore) {
          setError((err as Error).message)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [queryString, reloadToken])



  const formatRiskReason = (reason?: string) => {
    if (!reason) return '—'
    const map: Record<string, string> = {
      past_due: 'Past due',
      capacity_overload: 'Capacity overload',
      due_soon: 'Due soon',
      on_track: 'On track'
    }
    return map[reason] || reason
  }

  const openJob = async (jobId: string) => {
    try {
      const res = await fetch(`/jobs/${jobId}`)
      const payload = await res.json()
      setSelectedJob(payload.ok ? { job: payload.job, operations: payload.operations } : null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (view === 'briefing' || view === 'dashboard' || view === 'actions' || view === 'legacy') {
    return (
      <>
        <UnifiedHeader currentView={view} onViewChange={handleViewChange} />
        <LegacyDashboard 
          onExit={() => setView('phase1')} 
          currentView={view === 'briefing' || view === 'dashboard' || view === 'actions' ? view : 'dashboard'}
          onViewChange={(mode: string) => setView(mode as any)}
        />
      </>
    )
  }

  if (view === 'financial') {
    return (
      <>
        <UnifiedHeader currentView={view} onViewChange={handleViewChange} />
        <FinancialSummary />
      </>
    )
  }

  if (view === 'plant-pulse') {
    return (
      <>
        <UnifiedHeader currentView={view} onViewChange={handleViewChange} />
        <PlantPulse />
      </>
    )
  }

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">ShadowOps</p>
          <h1>Early Warning Board</h1>
          <p className="subhead">Risk-ranked jobs with ERP-neutral language.</p>
        </div>
      </header>

      <section className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">At-Risk Jobs</p>
          <p className="kpi-value">{metrics?.atRiskCount ?? '--'}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Due Next 7 Days</p>
          <p className="kpi-value">{metrics?.dueNext7Days ?? '--'}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Overloaded Resources</p>
          <p className="kpi-value">{metrics?.overloadedResourcesCount ?? '--'}</p>
        </article>
      </section>



      <section className="filters">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="on_hold">On Hold</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Due Start
          <input type="date" value={dueStart} onChange={(e) => setDueStart(e.target.value)} />
        </label>
        <label>
          Due End
          <input type="date" value={dueEnd} onChange={(e) => setDueEnd(e.target.value)} />
        </label>
        <label>
          Resource / Work Center
          <input
            type="text"
            placeholder="WC-10"
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          />
        </label>
      </section>

      {error && <div className="state state--error">{error}</div>}
      {loading && <div className="state">Loading jobs...</div>}
      {!loading && jobs.length === 0 && !error && (
        <div className="state">No jobs match the current filters.</div>
      )}

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Remaining Work</th>
              <th>Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.job_id} onClick={() => openJob(job.job_id)}>
                <td>{job.job_id}</td>
                <td>{job.due_date}</td>
                <td>{job.status}</td>
                <td>{formatRiskReason(job.risk_reason)}</td>
                <td>{job.remaining_work}</td>
                <td>
                  <span className={`risk-pill risk-pill--${job.risk_score >= 70 ? 'high' : 'low'}`}>
                    {job.risk_score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedJob && (
        <aside className="detail">
          <div className="detail__header">
            <h2>{selectedJob.job.job_id}</h2>
            <button onClick={() => setSelectedJob(null)}>Close</button>
          </div>
          <div className="detail__body">
            <p>
              <strong>Status:</strong> {selectedJob.job.status}
            </p>
            <p>
              <strong>Reason:</strong> {formatRiskReason(selectedJob.job.risk_reason)}
            </p>
            <p>
              <strong>Due Date:</strong> {selectedJob.job.due_date}
            </p>
            <p>
              <strong>Remaining Work:</strong> {selectedJob.job.remaining_work}
            </p>
            <p>
              <strong>Risk Score:</strong> {selectedJob.job.risk_score}
            </p>

            <h3>Operations</h3>
            <ul>
              {selectedJob.operations.map((op) => (
                <li key={op.operation_id}>
                  {op.resource_id} | Seq {op.sequence} | Remaining {op.remaining_time}h
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  )
}
