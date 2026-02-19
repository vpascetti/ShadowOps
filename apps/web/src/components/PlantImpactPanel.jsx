import '../styles/PlantImpactPanel.css'

const formatCurrency = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0'
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export default function PlantImpactPanel({ plantSummary = [], onSelectPlant }) {
  if (!plantSummary.length) {
    return (
      <div className="plant-impact-panel">
        <div className="plant-impact-header">
          <div>
            <h3>Plant Performance</h3>
            <p className="plant-impact-subtitle">
              No plant data available for the current filter.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalLateJobs = plantSummary.reduce((sum, plant) => sum + (plant.lateJobs || 0), 0)
  const totalLateRevenue = plantSummary.reduce((sum, plant) => sum + (plant.lateRevenue || 0), 0)
  const totalAtRiskRevenue = plantSummary.reduce((sum, plant) => sum + (plant.atRiskRevenue || 0), 0)
  const totalOnTrackRevenue = plantSummary.reduce((sum, plant) => sum + (plant.onTrackRevenue || 0), 0)

  return (
    <div className="plant-impact-panel">
      <div className="plant-impact-header">
        <div>
          <h3>Plant Performance</h3>
          <p className="plant-impact-subtitle">
            {totalLateJobs} late jobs |
            <span className="plant-impact-revenue-summary revenue-late">
              {formatCurrency(totalLateRevenue)} late
            </span>
            |{' '}
            <span className="plant-impact-revenue-summary revenue-at-risk">
              {formatCurrency(totalAtRiskRevenue)} at risk
            </span>
            |{' '}
            <span className="plant-impact-revenue-summary revenue-on-track">
              {formatCurrency(totalOnTrackRevenue)} on track
            </span>
          </p>
        </div>
      </div>
      <div className="plant-impact-cards">
        {plantSummary.map((plant) => {
          const isClickable = typeof onSelectPlant === 'function'
          return (
            <button
              key={plant.plant}
              type="button"
              className={`plant-impact-card${isClickable ? ' clickable' : ''}`}
              onClick={() => isClickable && onSelectPlant(plant.plant)}
            >
              <div className="plant-impact-title">{plant.plant}</div>
              <div className="plant-impact-metrics">
                <div className="plant-impact-metric">
                  <span className="plant-impact-label">Late</span>
                  <span className="plant-impact-value late">{plant.lateJobs}</span>
                </div>
                <div className="plant-impact-metric">
                  <span className="plant-impact-label">At Risk</span>
                  <span className="plant-impact-value at-risk">{plant.atRiskJobs}</span>
                </div>
                <div className="plant-impact-metric">
                  <span className="plant-impact-label">Total</span>
                  <span className="plant-impact-value">{plant.totalJobs}</span>
                </div>
              </div>
              <div className="plant-impact-revenue">
                <div className="plant-impact-revenue-row">
                  <span className="plant-impact-label">Late Revenue</span>
                  <span className="plant-impact-value revenue-late">
                    {formatCurrency(plant.lateRevenue)}
                  </span>
                </div>
                <div className="plant-impact-revenue-row">
                  <span className="plant-impact-label">At Risk Revenue</span>
                  <span className="plant-impact-value revenue-at-risk">
                    {formatCurrency(plant.atRiskRevenue)}
                  </span>
                </div>
                <div className="plant-impact-revenue-row">
                  <span className="plant-impact-label">On Track Revenue</span>
                  <span className="plant-impact-value revenue-on-track">
                    {formatCurrency(plant.onTrackRevenue)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
