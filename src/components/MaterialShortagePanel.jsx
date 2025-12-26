import { useMemo } from 'react'
import '../styles/MaterialShortagePanel.css'

export default function MaterialShortagePanel({ jobs }) {
  // Derive material shortage alerts from jobs
  const shortages = useMemo(() => {
    if (!jobs || jobs.length === 0) return []
    
    const alerts = []
    
    jobs.forEach((job) => {
      // Check if job has no start date or is delayed significantly
      if (job.status === 'Late' || job.status === 'At Risk') {
        // Simulate material shortage scenarios
        const qtyRemaining = parseFloat(job.QtyReleased || 0) - parseFloat(job.QtyCompleted || 0)
        
        if (qtyRemaining > 0 && job.progress !== null && job.progress < 0.5) {
          // Jobs less than 50% complete with significant qty remaining might need materials
          const daysUntilDue = job.DueDate ? 
            Math.ceil((new Date(job.DueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
          
          if (daysUntilDue !== null && daysUntilDue <= 14) {
            alerts.push({
              id: `shortage-${job.Job}`,
              job: job.Job,
              part: job.Part || 'Unknown Part',
              workCenter: job.WorkCenter,
              qtyNeeded: Math.ceil(qtyRemaining),
              dueDate: job.DueDate,
              daysUntilDue: daysUntilDue,
              severity: daysUntilDue <= 3 ? 'critical' : daysUntilDue <= 7 ? 'warning' : 'watch'
            })
          }
        }
      }
    })
    
    // Sort by days until due (most urgent first)
    alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    
    return alerts.slice(0, 10) // Top 10 most urgent
  }, [jobs])

  if (shortages.length === 0) {
    return (
      <div className="material-shortage-panel">
        <h3>Material Shortages</h3>
        <div className="empty-state">
          <p>✓ No material shortages detected</p>
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
                  {shortage.dueDate} ({shortage.daysUntilDue} days)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
