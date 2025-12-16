/**
 * MetricCard: Display a key metric (Total, On Track, At Risk, Late)
 * color: one of 'neutral', 'green', 'orange', 'red'
 */
function MetricCard({ label, value, color }) {
  const colorClass = `metric-${color}`

  return (
    <div className={`metric-card ${colorClass}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

export default MetricCard
