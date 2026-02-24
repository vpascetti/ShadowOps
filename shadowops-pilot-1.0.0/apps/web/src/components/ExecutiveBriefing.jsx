import { useMemo, useState } from 'react'
import MetricCard from './MetricCard'
import { getShortageInfo, datasetHasShortageSignals } from '../utils/shortage.js'
// CENTRALIZED METRICS - Use only centralized calculations
import {
  parseDate,
  getJobOrderValue,
  getJobPlant,
  calculateRevenueByStatus,
  formatCurrency
} from '../utils/metricsCalculations'

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
    .slice(0, 3)
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
  const overdue = risks.filter((r) => r.status === 'Late').length

  const toBucket = (override) => {
    if (override) return override
    if (overdue > 0 || (urgency !== null && urgency <= 1)) return 'Today'
    if (urgency !== null && urgency <= 5) return 'This Week'
    return 'Next Week'
  }

  if (drivers.materialCount > 0) {
    actions.push({
      who: 'Procurement',
      what: 'expedite material, confirm ETA, communicate impact',
      bucket: toBucket(drivers.materialCount > 2 ? 'Today' : undefined),
      impact: 'Protects customer delivery commitments.',
    })
  }

  if (drivers.wcDriver) {
    actions.push({
      who: 'Production',
      what: `prioritize run list on ${drivers.wcDriver.workCenter} and consider overtime/resequencing`,
      bucket: toBucket(urgency !== null && urgency <= 2 ? 'Today' : undefined),
      impact: 'Stabilizes on-time delivery on the bottleneck.',
    })
  }

  if (overdue > 0) {
    actions.push({
      who: 'Customer Service',
      what: 'confirm ship expectations and notify customers of delays',
      bucket: 'Today',
      impact: 'Maintains customer trust and clarity.',
    })
  }

  while (actions.length < 3) {
    actions.push({
      who: 'Operations',
      what: 'keep daily snapshot cadence and monitor jobs due within 7 days',
      bucket: toBucket('This Week'),
      impact: 'Keeps delivery confidence high.',
    })
  }

  return actions.slice(0, 3)
}

function normalizeLabel(value) {
  return String(value || '').trim()
}

function bumpCount(map, label) {
  if (!label) return
  map[label] = (map[label] || 0) + 1
}

function getTopLabel(map) {
  const entries = Object.entries(map)
  if (!entries.length) return ''
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

function simplifyCause(text, isMaterial) {
  if (isMaterial) return 'Material'
  const value = String(text || '').trim().toLowerCase()
  if (!value) return 'Unspecified'
  if (/material|shortage|stock|inventory/.test(value)) return 'Material'
  if (/labor|staff|manpower|crew/.test(value)) return 'Labor'
  if (/capacity|bottleneck|work center|workcenter|machine|downtime/.test(value)) return 'Capacity'
  if (/quality|scrap|rework|defect|inspection/.test(value)) return 'Quality'
  if (/schedule|late|due|priority/.test(value)) return 'Schedule'
  return 'Other'
}

function causeClass(label) {
  return `cause-${String(label || '').toLowerCase().replace(/\s+/g, '-')}`
}

function statusClass(status) {
  const value = String(status || '').toLowerCase().replace(/\s+/g, '-')
  return value ? `status-${value}` : 'status-unknown'
}

export default function ExecutiveBriefing({ asOfDate, metrics = {}, jobs = [], loadSummary = [], importStats, dataSource }) {
  const { total = 0, late = 0, projectedLate = 0, atRisk = 0 } = metrics || {}
  const sourceLabel = importStats?.source || (dataSource === 'API' ? 'Local API' : 'CSV snapshot')
  const snapshotLabel = importStats?.snapshotTimestamp ? new Date(importStats.snapshotTimestamp) : asOfDate
  const riskList = topRisks(jobs)
  const drivers = computeDrivers(jobs, loadSummary, snapshotLabel instanceof Date ? snapshotLabel : new Date(), importStats)
  const actions = buildActions(riskList, drivers, snapshotLabel instanceof Date ? snapshotLabel : new Date())
  const [showLateBreakdown, setShowLateBreakdown] = useState(false)

  const latePlantSummary = useMemo(() => {
    const summary = {}
    let debugLateCount = 0
    let debugLateRevenue = 0
    
    jobs.forEach((job) => {
      if (job.status !== 'Late') return
      
      debugLateCount++
      const orderValue = getJobOrderValue(job)
      debugLateRevenue += orderValue
      
      const plant = getJobPlant(job)
      if (!summary[plant]) {
        summary[plant] = {
          plant,
          lateJobs: 0,
          lateRevenue: 0,
          materialCount: 0,
          rootCauses: {},
          owners: {}
        }
      }

      const entry = summary[plant]
      entry.lateJobs += 1
      entry.lateRevenue += orderValue

      const shortageInfo = getShortageInfo(job, importStats)
      if (shortageInfo.shortageFlag) entry.materialCount += 1

      bumpCount(entry.rootCauses, normalizeLabel(shortageInfo.normalizedRootCause))
      bumpCount(entry.owners, normalizeLabel(shortageInfo.normalizedAccountable))
    })

    console.log('[ExecutiveBriefing] Late jobs debug:', {
      totalJobs: jobs.length,
      lateJobs: debugLateCount,
      lateRevenue: debugLateRevenue,
      sampleLateJob: jobs.find(j => j.status === 'Late')
    })
    
    return Object.values(summary)
      .map((entry) => {
        const topRoot = getTopLabel(entry.rootCauses)
        const topOwner = getTopLabel(entry.owners)
        const materialDominates = entry.materialCount >= Math.ceil(entry.lateJobs / 2)
        const topCause = materialDominates ? 'Material' : topRoot || (entry.materialCount > 0 ? 'Material' : 'Unknown')

        return {
          ...entry,
          topCause,
          topOwner: topOwner || 'Unassigned'
        }
      })
      .sort((a, b) => {
        if (b.lateJobs !== a.lateJobs) return b.lateJobs - a.lateJobs
        return b.lateRevenue - a.lateRevenue
      })
  }, [jobs, importStats])

  const totalLateRevenue = latePlantSummary.reduce((sum, plant) => sum + (plant.lateRevenue || 0), 0)
  
  // Use centralized revenue calculation via imported function
  const revenueByStatus = useMemo(() => calculateRevenueByStatus(jobs), [jobs])

  const snapshotText = snapshotLabel ? formatDate(snapshotLabel) : 'Unknown'
  const glanceItems = [
    drivers.wcDriver
      ? `Bottleneck: ${drivers.wcDriver.workCenter} has ${(drivers.wcDriver.lateJobs || 0) + (drivers.wcDriver.atRiskJobs || 0)} of ${drivers.riskCount} late/at-risk jobs.`
      : 'Bottleneck: no major concentration detected.',
    drivers.hasSignals
      ? (drivers.materialCount > 0
        ? `Materials: ${drivers.materialCount} late/at-risk jobs flagged.`
        : 'Materials: no major shortages flagged.')
      : 'Materials: shortage signals not included.',
    drivers.nearTermCount > 0
      ? `Due soon: ${drivers.nearTermCount} jobs due within 7 days.`
      : 'Due soon: no 7-day due pressure.'
  ]

  const bucketOrder = ['Today', 'This Week', 'Next Week']
  const actionsByBucket = bucketOrder
    .map((bucket) => ({
      bucket,
      items: actions.filter((action) => action.bucket === bucket)
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="executive-briefing">
      <div className="briefing-stack">
        <header className="briefing-header">
          <div>
            <h2>Executive Briefing</h2>
            <div className="briefing-meta">
              <span>Snapshot: {snapshotText}</span>
              <span>Source: {sourceLabel}</span>
            </div>
          </div>
          <div className="briefing-sub right">Jobs: {total}</div>
        </header>

        <section className="briefing-section briefing-cards">
          <MetricCard label="Total Jobs" value={total} color="neutral" />
          <MetricCard
            label="Late"
            value={late}
            color="red"
            tooltip="Click to break down late jobs by plant"
            onClick={() => setShowLateBreakdown((prev) => !prev)}
          />
          <MetricCard label="Late Revenue" value={formatCurrency(revenueByStatus.late)} color="red" />
          <MetricCard label="At Risk Revenue" value={formatCurrency(revenueByStatus.atRisk)} color="orange" />
          <MetricCard label="Expected Revenue" value={formatCurrency(revenueByStatus.onTrack)} color="green" />
        </section>

        {showLateBreakdown && (
          <section className="briefing-section briefing-plant-panel">
            <div className="briefing-plant-header">
              <div>
                <h3>Late Jobs by Plant</h3>
                <p className="briefing-plant-subtitle">
                  {late} late jobs | {formatCurrency(totalLateRevenue)} revenue at risk
                </p>
              </div>
              <button
                type="button"
                className="briefing-plant-close"
                onClick={() => setShowLateBreakdown(false)}
              >
                Hide
              </button>
            </div>
            {latePlantSummary.length === 0 ? (
              <div className="briefing-empty">No late jobs in the current snapshot.</div>
            ) : (
              <div className="briefing-plant-grid">
                {latePlantSummary.map((plant) => (
                  <div key={plant.plant} className="briefing-plant-card">
                    <div className="briefing-plant-title">{plant.plant}</div>
                    <div className="briefing-plant-tags">
                      <span className="briefing-plant-tag cause">{plant.topCause}</span>
                      <span className="briefing-plant-tag owner">{plant.topOwner}</span>
                    </div>
                    <div className="briefing-plant-metrics">
                      <div>
                        <span className="briefing-plant-label">Late Jobs</span>
                        <span className="briefing-plant-value late">{plant.lateJobs}</span>
                      </div>
                      <div>
                        <span className="briefing-plant-label">Late Revenue</span>
                        <span className="briefing-plant-value">{formatCurrency(plant.lateRevenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="briefing-section">
          <h3>At a Glance</h3>
          <ul className="briefing-glance">
            {glanceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="briefing-section">
          <h3>Top Risks</h3>
          {riskList.length === 0 ? (
            <div className="briefing-empty">No critical risks detected for this snapshot.</div>
          ) : (
            <ul className="risk-list">
              {riskList.map((r) => (
                <li key={r.Job} className={`risk-item status-${(r.status || '').toLowerCase()}`}>
                  <div className="risk-title">Job {r.Job}</div>
                  <div className="risk-meta">
                    {(() => {
                      const shortageInfo = getShortageInfo(r, importStats)
                      const rawCause = shortageInfo.normalizedRootCause || r.Reason || r.RootCause
                      const causeLabel = simplifyCause(rawCause, shortageInfo.shortageFlag)
                      const statusLabel = r.status === 'Late' ? 'Late' : r.status || r.projectedStatus || 'Status'
                      return (
                        <>
                          <span>{r.Customer || 'Unknown customer'}</span>
                          <span> · </span>
                          <span>{r.WorkCenter || 'Unknown WC'}</span>
                          <span> · Due {formatDate(r.DueDate)}</span>
                          <span className={`pill subtle ${causeClass(causeLabel)}`}>Cause - {causeLabel}</span>
                          <span className={`pill status-pill ${statusClass(statusLabel)}`}>{statusLabel}</span>
                        </>
                      )
                    })()}
                  </div>
                  {(r.Reason || r.RootCause) && (
                    <div className="risk-reason">{r.Reason || r.RootCause}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="briefing-section">
          <h3>Next Actions</h3>
          <div className="action-buckets">
            {actionsByBucket.map((group) => (
              <div key={group.bucket} className="action-bucket">
                <div className="action-bucket-title">{group.bucket}</div>
                <ul className="action-list">
                  {group.items.map((a, idx) => (
                    <li key={`${group.bucket}-${idx}`}>
                      <span className="pill subtle">{a.who}</span> {a.what}
                      {a.impact ? <span className="action-impact">{a.impact}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
