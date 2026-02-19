/**
 * MetricCard: Display a key metric (Total, On Track, At Risk, Late)
 * color: one of 'neutral', 'green', 'orange', 'red'
 */
function MetricCard({ label, value, color, tooltip, onClick }) {
  const colorClass = `metric-${color}`
  const isClickable = typeof onClick === 'function'

  const handleKeyDown = (event) => {
    if (!isClickable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`metric-card ${colorClass}${isClickable ? ' clickable' : ''}`}
      title={tooltip}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

export default MetricCard
