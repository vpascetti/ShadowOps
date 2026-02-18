import MetricCard from './MetricCard'
import { getShortageInfo, datasetHasShortageSignals } from '../utils/shortage.js'

function formatDate(d) {
  try {
    if (!d) return 'Unknown'
    const dt = d instanceof Date ? d : new Date(d)
    return dt.toISOString().split('T')[0]
  } catch (e) {
    return String(d)
  }
}

function statusRank(job) {
  if (job.status === 'Late') return 0
  if (job.status === 'At Risk') return 1
  if (job.projectedStatus === 'Projected Late') return 2
  return 3
}

function parseDue(dateStr) {
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

function topRisks(jobs = []) {
  return [...jobs]
    .filter((j) => ['Late', 'At Risk'].includes(j.status) || j.projectedStatus === 'Projected Late')
    .sort((a, b) => {
      const rankDiff = statusRank(a) - statusRank(b)
      if (rankDiff !== 0) return rankDiff
      const dueA = parseDue(a.DueDate)
      const dueB = parseDue(b.DueDate)
      if (dueA && dueB) {
        const diff = dueA.getTime() - dueB.getTime()
        if (diff !== 0) return diff
      }
      return (b.priorityScore || 0) - (a.priorityScore || 0)
    })
    .slice(0, 5)
}

function computeDrivers(jobs = [], loadSummary = [], asOfDate = new Date(), importStats) {
  const riskJobs = jobs.filter((j) => ['Late', 'At Risk'].includes(j.status) || j.projectedStatus === 'Projected Late')
  const riskCount = riskJobs.length || 1

  const wcDriver = loadSummary
    .filter((l) => (l.lateJobs || 0) + (l.atRiskJobs || 0) > 0)
    .sort((a, b) => ((b.lateJobs || 0) + (b.atRiskJobs || 0)) - ((a.lateJobs || 0) + (a.atRiskJobs || 0)))[0]

  const materialCount = riskJobs.filter((j) => getShortageInfo(j, importStats).shortageFlag).length
  const hasSignals = datasetHasShortageSignals(importStats, jobs)

  const nearTermCount = jobs.filter((j) => {
    const due = parseDue(j.DueDate)
    if (!due) return false
    const diffDays = Math.floor((due.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  }).length

  return {
    wcDriver,
    materialCount,
    nearTermCount,
    riskCount,
    hasSignals,
  }
}

function buildActions(risks, drivers, asOfDate = new Date()) {
  const actions = []
  const earliestRisk = risks[0]
  const earliestDue = earliestRisk ? parseDue(earliestRisk.DueDate) : null
  const urgency = earliestDue ? Math.max(0, Math.floor((earliestDue - asOfDate) / (1000 * 60 * 60 * 24))) : null

  if (drivers.materialCount > 0) {
    actions.push({
      who: 'Procurement',
      what: 'expedite material, confirm ETA, communicate impact',
      when: drivers.materialCount > 2 || (urgency !== null && urgency <= 3) ? 'within 24h' : 'by end of day',
    })
  }

  if (drivers.wcDriver) {
    actions.push({
      who: 'Production',
      what: `prioritize run list on ${drivers.wcDriver.workCenter} and consider overtime/resequencing`,
      when: urgency !== null && urgency <= 2 ? 'today' : 'next 48h',
    })
  }

  const overdue = risks.filter((r) => r.status === 'Late').length
  if (overdue > 0) {
    actions.push({
      who: 'Customer Service',
      what: 'confirm ship expectations and notify customers of delays',
      when: 'immediately',
    })
  }

  while (actions.length < 3) {
    actions.push({
      who: 'Operations',
      what: 'keep daily snapshot cadence and monitor jobs due within 7 days',
      when: 'this week',
    })
  }

  return actions.slice(0, 3)
}

export default function ExecutiveBriefing({ asOfDate, metrics = {}, jobs = [], loadSummary = [], importStats, dataSource }) {
  const { total = 0, late = 0, projectedLate = 0, atRisk = 0 } = metrics || {}
  const sourceLabel = importStats?.source || (dataSource === 'API' ? 'Local API' : 'CSV snapshot')
  const snapshotLabel = importStats?.snapshotTimestamp ? new Date(importStats.snapshotTimestamp) : asOfDate
  const riskList = topRisks(jobs)
  const drivers = computeDrivers(jobs, loadSummary, snapshotLabel instanceof Date ? snapshotLabel : new Date(), importStats)
  const actions = buildActions(riskList, drivers, snapshotLabel instanceof Date ? snapshotLabel : new Date())

  return (
    <div className="executive-briefing">
      <div className="briefing-stack">
        <header className="briefing-header">
          <div>
            <h2>ShadowOps Executive Briefing</h2>
            <div className="briefing-sub">As of {formatDate(snapshotLabel)}</div>
            <div className="briefing-sub">Data source: {sourceLabel}</div>
          </div>
          <div className="briefing-sub right">Rows: {importStats?.totalRows ?? '—'} · Jobs: {total}</div>
        </header>

        <section className="briefing-section briefing-cards">
          <MetricCard label="Total Jobs" value={total} color="neutral" />
          <MetricCard label="Late" value={late} color="red" />
          <MetricCard label="Projected Late" value={projectedLate} color="orange" />
          <MetricCard label="At Risk" value={atRisk} color="orange" />
        </section>

        <section className="briefing-section">
          <div className="briefing-row">
            <div className="briefing-col">
              <h3>Top Risks</h3>
              {riskList.length === 0 ? (
                <div className="briefing-empty">No critical risks detected for this snapshot.</div>
              ) : (
                <ul className="risk-list">
                  {riskList.map((r) => (
                    <li key={r.Job} className={`risk-item status-${(r.status || '').toLowerCase()}`}>
                      <div className="risk-title">Job {r.Job}</div>
                      <div className="risk-meta">
                        <span>{r.Customer || 'Unknown customer'}</span>
                        <span> · </span>
                        <span>{r.WorkCenter || 'Unknown WC'}</span>
                        <span> · Due {formatDate(r.DueDate)}</span>
                        <span className="pill">{r.status === 'Late' ? 'Late' : r.status || r.projectedStatus || 'Status'}</span>
                      </div>
                      {(r.Reason || r.RootCause) && (
                        <div className="risk-reason">{r.Reason || r.RootCause}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="briefing-col">
              <h3>Top 3 Risk Drivers</h3>
              <ul className="driver-list">
                <li>
                  {drivers.wcDriver
                    ? `Bottleneck: ${drivers.wcDriver.workCenter} has ${(drivers.wcDriver.lateJobs || 0) + (drivers.wcDriver.atRiskJobs || 0)} of ${drivers.riskCount} late/at-risk jobs.`
                    : 'No major work center concentration detected.'}
                </li>
                <li>
                  {drivers.hasSignals
                    ? (drivers.materialCount > 0
                      ? `Materials: ${drivers.materialCount} late/at-risk jobs tagged Material.`
                      : 'No major material-related risks detected.')
                    : 'Material shortage signals not included in this snapshot.'}
                </li>
                <li>
                  {drivers.nearTermCount > 0
                    ? `Near-term load: ${drivers.nearTermCount} jobs due within 7 days.`
                    : 'No near-term due date pressure detected.'}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="briefing-section">
          <h3>Top 3 Actions Required</h3>
          <ul className="action-list">
            {actions.map((a, idx) => (
              <li key={idx}>
                <span className="pill subtle">{a.who}</span> {a.what} <span className="muted">({a.when})</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
