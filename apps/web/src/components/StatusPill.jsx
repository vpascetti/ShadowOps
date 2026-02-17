/**
 * StatusPill: Color-coded status indicator
 * - "On Track" → green
 * - "At Risk" → orange/yellow
 * - "Late" → red
 */
function StatusPill({ status }) {
  const classMap = {
    'On Track': 'pill-green',
    'At Risk': 'pill-orange',
    'Late': 'pill-red',
  }

  const className = classMap[status] || 'pill-default'

  return <span className={`status-pill ${className}`}>{status}</span>
}

export default StatusPill
