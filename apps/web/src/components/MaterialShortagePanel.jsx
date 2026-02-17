import { useMemo } from 'react'
import '../styles/MaterialShortagePanel.css'
import { getShortageInfo, datasetHasShortageSignals } from '../utils/shortage.js'

// Helper function to format dates as MM-DD-YYYY
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

export default function MaterialShortagePanel({ jobs, importStats }) {
  const hasSignals = datasetHasShortageSignals(importStats)

  // Derive material shortage alerts from jobs using source-of-truth flags/text
  const shortages = useMemo(() => {
    if (!jobs || jobs.length === 0) return []
    const alerts = []
    jobs.forEach((job) => {
      const info = getShortageInfo(job, importStats)
      if (info.shortageFlag) {
        const qtyRemaining = parseFloat(job.QtyReleased || 0) - parseFloat(job.QtyCompleted || 0)
        const daysUntilDue = job.DueDate ? Math.ceil((new Date(job.DueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
        alerts.push({
          id: `shortage-${job.Job}`,
          job: job.Job,
          part: job.Part || 'Unknown Part',
          workCenter: job.WorkCenter,
          qtyNeeded: isNaN(qtyRemaining) ? null : Math.max(0, Math.ceil(qtyRemaining)),
          dueDate: job.DueDate,
          daysUntilDue,
          severity: daysUntilDue === null ? 'watch' : daysUntilDue <= 3 ? 'critical' : daysUntilDue <= 7 ? 'warning' : 'watch'
        })
      }
    })
    alerts.sort((a, b) => (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999))
    return alerts.slice(0, 10)
  }, [jobs, importStats])

  if (!hasSignals) {
    return (
      <div className="material-shortage-panel">
        <h3>Material Shortages</h3>
        <div className="empty-state">
          <p>ℹ Material shortage signals not included in this snapshot</p>
        </div>
      </div>
    )
  }

  if (shortages.length === 0) {
    return (
      <div className="material-shortage-panel">
        <h3>Material Shortages</h3>
        <div className="empty-state">
          <p>✓ No material shortages flagged in this snapshot</p>
        </div>
      </div>
    )
  }

  return (
    <div className="material-shortage-panel">
      <h3>Material Shortages</h3>
      <p className="panel-description">
        Jobs requiring materials to meet due dates
      </p>
      <div className="shortage-list">
        {shortages.map((shortage) => (
          <div key={shortage.id} className={`shortage-card ${shortage.severity}`}>
            <div className="shortage-header">
              <div className="shortage-job">Job {shortage.job}</div>
              <div className={`shortage-severity ${shortage.severity}`}>
                {shortage.severity === 'critical' ? '🔴 URGENT' : shortage.severity === 'warning' ? '⚠️ WARNING' : '⏰ WATCH'}
              </div>
            </div>
            <div className="shortage-details">
              <div className="shortage-row">
                <span className="shortage-label">Part:</span>
                <span className="shortage-value">{shortage.part}</span>
              </div>
              <div className="shortage-row">
                <span className="shortage-label">Work Center:</span>
                <span className="shortage-value">{shortage.workCenter}</span>
              </div>
              <div className="shortage-row">
                <span className="shortage-label">Qty Needed:</span>
                <span className="shortage-value shortage-qty">{shortage.qtyNeeded} units</span>
              </div>
              <div className="shortage-row">
                <span className="shortage-label">Order By:</span>
                <span className="shortage-value shortage-date">
                  {formatDate(shortage.dueDate)} ({shortage.daysUntilDue} days)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
