import { useEffect, useState } from 'react'
import '../styles/financial-summary.css'

export default function FinancialSummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unitPrice, setUnitPrice] = useState(100)
  const [hourlyRate, setHourlyRate] = useState(75)
  const [dataSource, setDataSource] = useState('auto')

  const fetchSummary = async (price = unitPrice, rate = hourlyRate, source = dataSource) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/financial-summary?unitPrice=${price}&stdHourlyRate=${rate}&source=${source}`
      )
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to fetch financial summary')
      setSummary(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const handlePriceChange = (e) => {
    const price = parseFloat(e.target.value)
    setUnitPrice(price)
    fetchSummary(price, hourlyRate, dataSource)
  }

  const handleRateChange = (e) => {
    const rate = parseFloat(e.target.value)
    setHourlyRate(rate)
    fetchSummary(unitPrice, rate, dataSource)
  }

  const handleSourceChange = (newSource) => {
    setDataSource(newSource)
    fetchSummary(unitPrice, hourlyRate, newSource)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value) => {
    return `${parseFloat(value).toFixed(1)}%`
  }

  if (loading) return <div className="financial__loading">Loading financial data...</div>
  if (error) return <div className="financial__error">Error: {error}</div>
  if (!summary) return <div className="financial__empty">No financial data available</div>

  const { summary: fin, metrics, assumptions, dataSource: activeDataSource } = summary

  return (
    <div className="financial">
      <header className="financial__header">
        <div>
          <p className="eyebrow">ShadowOps</p>
          <h1>Financial Summary</h1>
          <p className="subhead">Executive dashboard for manufacturing financial impact.</p>
        </div>
      </header>

      <section className="financial__data-source">
        <div className="source-selector">
          <label>Data Source:</label>
          <div className="source-buttons">
            <button
              className={`source-btn ${dataSource === 'auto' ? 'active' : ''}`}
              onClick={() => handleSourceChange('auto')}
              title="Auto-select between IQMS (live) and cached database"
            >
              Auto {activeDataSource === 'iqms' && '(IQMS Live)' || activeDataSource === 'cached' && '(Cached)'}
            </button>
            <button
              className={`source-btn ${dataSource === 'iqms' ? 'active' : ''}`}
              onClick={() => handleSourceChange('iqms')}
              title="Query IQMS directly for real-time data"
            >
              IQMS Live 🔴
            </button>
            <button
              className={`source-btn ${dataSource === 'cached' ? 'active' : ''}`}
              onClick={() => handleSourceChange('cached')}
              title="Use cached database data"
            >
              Cached DB
            </button>
          </div>
        </div>
      </section>

      <section className="financial__assumptions">
        <div className="assumption-input">
          <label>
            Unit Price ($):
            <input
              type="number"
              min="1"
              step="5"
              value={unitPrice}
              onChange={handlePriceChange}
            />
          </label>
        </div>
        <div className="assumption-input">
          <label>
            Std Hourly Rate ($):
            <input
              type="number"
              min="1"
              step="5"
              value={hourlyRate}
              onChange={handleRateChange}
            />
          </label>
        </div>
      </section>

      <section className="financial__grid">
        <article className="financial__card financial__card--risk">
          <div className="card__icon">⚠️</div>
          <p className="card__label">Revenue at Risk</p>
          <p className="card__value">{formatCurrency(fin.revenueAtRisk)}</p>
          <p className="card__detail">
            {metrics.totalQtyReleased} units @ ${unitPrice}/unit
          </p>
        </article>

        <article className="financial__card financial__card--delayed">
          <div className="card__icon">📉</div>
          <p className="card__label">Delayed Order Impact</p>
          <p className="card__value">{formatCurrency(fin.delayedOrderImpact)}</p>
          <p className="card__detail">
            {metrics.overdueCount} overdue + {metrics.dueSoonCount} due soon
          </p>
        </article>

        <article className="financial__card financial__card--cost">
          <div className="card__icon">🔧</div>
          <p className="card__label">Resource Costs (Remaining)</p>
          <p className="card__value">{formatCurrency(fin.resourceCosts)}</p>
          <p className="card__detail">
            {metrics.totalRemainingWork} hours @ ${hourlyRate}/hr
          </p>
        </article>

        <article className="financial__card financial__card--wip">
          <div className="card__icon">📦</div>
          <p className="card__label">Work-in-Progress Value</p>
          <p className="card__value">{formatCurrency(fin.wipValue)}</p>
          <p className="card__detail">
            {metrics.totalRemainingWork} units remaining
          </p>
        </article>

        <article className="financial__card financial__card--ontime">
          <div className="card__icon">✅</div>
          <p className="card__label">On-Time Delivery Rate</p>
          <p className="card__value">{formatPercent(fin.onTimeDeliveryPct)}</p>
          <p className="card__detail">
            {metrics.completedJobs} of {metrics.totalJobs} jobs completed
          </p>
        </article>

        <article className="financial__card financial__card--throughput">
          <div className="card__icon">⚠️</div>
          <p className="card__label">At-Risk Jobs</p>
          <p className="card__value">{metrics.atRiskCount}</p>
          <p className="card__detail">
            Risk score ≥ 70
          </p>
        </article>
      </section>

      <section className="financial__details">
        <h2>Key Metrics Breakdown</h2>
        <div className="details__grid">
          <div className="detail__item">
            <span className="detail__label">Total Jobs:</span>
            <span className="detail__value">{metrics.totalJobs}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">Jobs Completed:</span>
            <span className="detail__value">{metrics.completedJobs}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">Total Remaining Work:</span>
            <span className="detail__value">{metrics.totalRemainingWork}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">Overdue Jobs:</span>
            <span className="detail__value detail__value--warning">{metrics.overdueCount}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">Due Within 7 Days:</span>
            <span className="detail__value detail__value--caution">{metrics.dueSoonCount}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">At-Risk Jobs:</span>
            <span className="detail__value detail__value--warning">{metrics.atRiskCount}</span>
          </div>
        </div>
      </section>

      <section className="financial__assumptions-display">
        <h3>Calculation Assumptions</h3>
        <p>
          Data sourced from <strong>{activeDataSource === 'iqms' ? 'IQMS (Live)' : 'Cached Database'}</strong>.
          Financial calculations use a unit price of <strong>${assumptions.unitPrice}</strong> and
          a standard hourly rate of <strong>${assumptions.stdHourlyRate}</strong>.
          Adjust these values above or change data source to see real-time impact on financial metrics.
        </p>
      </section>
    </div>
  )
}
