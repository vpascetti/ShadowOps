import React from 'react'
import MetricCard from './MetricCard'

function formatDate(d) {
  try {
    if (!d) return 'Unknown'
    const dt = d instanceof Date ? d : new Date(d)
    return dt.toISOString().split('T')[0]
  } catch (e) {
    return String(d)
  }
}

function alertPriorityKey(a) {
  const t = (a.title || '').toLowerCase()
  if (t.includes(' is late') || (t.includes('late') && !t.includes('projected'))) return 0
  if (t.includes('projected')) return 1
  if (t.includes('behind') || t.includes('risk') || a.severity === 'warning') return 2
  return 3
}

export default function ExecutiveBriefing({ asOfDate, metrics = {}, alerts = [], loadSummary = [], runList = [] }) {
  const { total = 0, late = 0, projectedLate = 0, atRisk = 0 } = metrics || {}

  // Top risks: sort by requested priority and take up to 3
  const topRisks = [...(alerts || [])].sort((a, b) => {
    const pa = alertPriorityKey(a)
    const pb = alertPriorityKey(b)
    if (pa !== pb) return pa - pb
    return (a.dueDate || '').localeCompare(b.dueDate || '')
  }).slice(0, 3)

  // Hotspots: sort by load score descending and take top 3
  const hotspots = [...(loadSummary || [])].sort((a, b) => (b.loadScore || 0) - (a.loadScore || 0)).slice(0, 3)

  // Recommendation rules
  const recs = []
  if (runList && runList.length > 0 && runList[0].jobs && runList[0].jobs.length > 0) {
    const job = runList[0].jobs[0]
    recs.push(`Run Job ${job.Job || job.job || job.Job} next on ${runList[0].workCenter}`)
  }

  const highHotspot = hotspots.find(h => (h.loadScore || 0) >= 6)
  if (highHotspot) {
    recs.push(`Avoid starting new jobs on ${highHotspot.workCenter} today.`)
  }

  const projectedTotal = (typeof projectedLate === 'number') ? projectedLate : (loadSummary || []).reduce((acc, cur) => acc + (cur.projectedLateJobs || 0), 0)
  if (projectedTotal > 0) {
    recs.push('Some jobs are projected late — prioritize finishing partially completed work.')
  }

  // Ensure exactly three bullets (fill with benign guidance if needed)
  while (recs.length < 3) recs.push('Maintain focus on high-value jobs and clear downstream blockers.')

  return (
    <div className="executive-briefing">
      <header className="briefing-header">
        <h2>ShadowOps Executive Briefing</h2>
        <div className="briefing-sub">As of {formatDate(asOfDate)}</div>
        <div className="briefing-sub">Data source: CSV snapshot</div>
      </header>

      <section className="briefing-grid">
        <div className="briefing-section briefing-cards">
          <MetricCard label="Total Jobs" value={total} color="neutral" />
          <MetricCard label="Late" value={late} color="red" />
          <MetricCard label="Projected Late" value={projectedLate} color="orange" />
          <MetricCard label="At Risk" value={atRisk} color="orange" />
        </div>

        <div className="briefing-section">
          <h3>Top Risks</h3>
          {topRisks.length === 0 ? (
            <div className="briefing-empty">No critical risks detected for this snapshot.</div>
          ) : (
            <div className="risk-cards">
              {topRisks.map((a) => (
                <div key={a.id} className="risk-card">
                  <div className="risk-title">{a.title}</div>
                  <div className="risk-desc">{a.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="briefing-section">
          <h3>Work Center Hotspots</h3>
          {hotspots.length === 0 ? (
            <div className="briefing-empty">No hotspots identified.</div>
          ) : (
            <div className="hotspot-cards">
              {hotspots.map((h) => (
                <div key={h.workCenter} className="hotspot-card">
                  <div className="hotspot-header">
                    <div className="hotspot-name">{h.workCenter}</div>
                    <div className={`hotspot-severity ${h.loadScore >= 6 ? 'high' : h.loadScore >=2 ? 'watch' : 'healthy'}`}>
                      {h.loadScore >= 6 ? 'High' : h.loadScore >=2 ? 'Watch' : 'Healthy'}
                    </div>
                  </div>
                  <div className="hotspot-stats">
                    <div>Total: {h.totalJobs}</div>
                    <div>Late: {h.lateJobs}</div>
                    <div>Projected Late: {h.projectedLateJobs}</div>
                    <div>At Risk: {h.atRiskJobs}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="briefing-section">
          <h3>What ShadowOps Recommends</h3>
          <ul>
            {recs.slice(0,3).map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
