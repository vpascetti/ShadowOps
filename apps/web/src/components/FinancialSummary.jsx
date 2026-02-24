import { useEffect, useState } from 'react'
import '../styles/financial-summary.css'

export default function FinancialSummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const getDatePreset = (preset) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    
    switch (preset) {
      case 'thisMonth':
        return {
          start: `${year}-${month}-01`,
          end: `${year}-${month}-${new Date(year, month, 0).getDate()}`
        }
      case 'lastMonth':
        const lastMonthDate = new Date(year, month - 2, 1)
        const lmYear = lastMonthDate.getFullYear()
        const lmMonth = String(lastMonthDate.getMonth() + 1).padStart(2, '0')
        const lastDay = new Date(lmYear, lmMonth, 0).getDate()
        return {
          start: `${lmYear}-${lmMonth}-01`,
          end: `${lmYear}-${lmMonth}-${lastDay}`
        }
      case 'nextMonth':
        const nextMonthDate = new Date(year, month, 1)
        const nmYear = nextMonthDate.getFullYear()
        const nmMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0')
        const nmLastDay = new Date(nmYear, nmMonth, 0).getDate()
        return {
          start: `${nmYear}-${nmMonth}-01`,
          end: `${nmYear}-${nmMonth}-${nmLastDay}`
        }
      case 'last30':
        const d30 = new Date(today)
        d30.setDate(d30.getDate() - 30)
        return {
          start: `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`,
          end: `${year}-${month}-${day}`
        }
      default:
        return { start: '', end: '' }
    }
  }

  const applyPreset = (preset) => {
    const { start, end } = getDatePreset(preset)
    setStartDate(start)
    setEndDate(end)
    // Call fetchSummary with the new dates directly
    fetchSummary(start, end)
  }

  const fetchSummary = async (sd = startDate, ed = endDate) => {
    setLoading(true)
    setError(null)
    try {
      let url = '/financial-summary'
      if (sd && ed) {
        url += `?startDate=${sd}&endDate=${ed}`
      }
      const res = await fetch(url)
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

  const { summary: fin, metrics, dateRange } = summary

  return (
    <div className="financial">
      {/* Date Range Filter */}
      <section className="financial__filters">
        <div className="filters__header">
          <h3>Filter by Promise Date Range</h3>
          {dateRange?.display && <span className="filters__current">Viewing: {dateRange.display}</span>}
        </div>
        
        <div className="filters__presets">
          <button 
            className="preset__btn" 
            onClick={() => applyPreset('thisMonth')}
          >
            This Month
          </button>
          <button 
            className="preset__btn" 
            onClick={() => applyPreset('lastMonth')}
          >
            Last Month
          </button>
          <button 
            className="preset__btn" 
            onClick={() => applyPreset('nextMonth')}
          >
            Next Month
          </button>
          <button 
            className="preset__btn" 
            onClick={() => applyPreset('last30')}
          >
            Last 30 Days
          </button>
        </div>

        <div className="filters__inputs">
          <div className="input__group">
            <label htmlFor="start-date">Start Date:</label>
            <input 
              id="start-date"
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="input__group">
            <label htmlFor="end-date">End Date:</label>
            <input 
              id="end-date"
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button 
            className="filters__apply"
            onClick={() => fetchSummary(startDate, endDate)}
          >
            Apply Filter
          </button>
          <button 
            className="filters__clear"
            onClick={() => { setStartDate(''); setEndDate(''); fetchSummary('', '') }}
          >
            Clear
          </button>
        </div>
      </section>
      <section className="financial__grid">
        <article className="financial__card financial__card--risk">
          <div className="card__icon"></div>
          <p className="card__label">Revenue at Risk</p>
          <p className="card__value">{formatCurrency(fin.revenueAtRisk)}</p>
          <p className="card__detail">
            {metrics.atRiskCount} at-risk jobs (score ≥ 70)
          </p>
        </article>

        <article className="financial__card financial__card--delayed">
          <div className="card__icon"></div>
          <p className="card__label">Delayed Order Impact</p>
          <p className="card__value">{formatCurrency(fin.delayedOrderImpact)}</p>
          <p className="card__detail">
            {metrics.overdueCount} overdue + {metrics.dueSoonCount} due soon
          </p>
        </article>

        <article className="financial__card financial__card--wip">
          <div className="card__icon"></div>
          <p className="card__label">Work-in-Progress Value</p>
          <p className="card__value">{formatCurrency(fin.wipValue)}</p>
          <p className="card__detail">
            {metrics.totalJobs} active jobs
          </p>
        </article>

        <article className="financial__card financial__card--total">
          <div className="card__icon"></div>
          <p className="card__label">Total Order Value</p>
          <p className="card__value">{formatCurrency(fin.totalOrderValue)}</p>
          <p className="card__detail">
            {metrics.jobsWithPricing} jobs with pricing data
          </p>
        </article>

        <article className="financial__card financial__card--ontime">
          <div className="card__icon"></div>
          <p className="card__label">On-Time Revenue</p>
          <p className="card__value">{fin.onTimeRevenue !== null ? formatCurrency(fin.onTimeRevenue) : 'N/A'}</p>
          <p className="card__detail">
            {metrics.onTimeReleaseCount 
              ? `${metrics.onTimeReleaseCount} releases shipped on time`
              : 'Pending shipping data'}
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
          <div className="detail__item">
            <span className="detail__label">Jobs with Pricing:</span>
            <span className="detail__value">{metrics.jobsWithPricing}</span>
          </div>
          <div className="detail__item">
            <span className="detail__label">Avg Unit Price:</span>
            <span className="detail__value">{formatCurrency(metrics.avgUnitPrice)}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
