import { useMemo, useState, useEffect } from 'react'
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
  const [expandedJobs, setExpandedJobs] = useState({})
  const [materialDetails, setMaterialDetails] = useState({})
  const [loadingDetails, setLoadingDetails] = useState({})
  
  const hasSignals = datasetHasShortageSignals(importStats, jobs)

  // Fetch detailed materials for a job
  const fetchMaterialDetails = async (jobId) => {
    if (materialDetails[jobId] || loadingDetails[jobId]) return
    
    setLoadingDetails(prev => ({ ...prev, [jobId]: true }))
    try {
      const response = await fetch(`/jobs/${jobId}/materials`)
      const data = await response.json()
      if (data.ok && data.materials) {
        // Aggregate materials by item_no (sum quantities, find date range)
        const aggregated = {}
        data.materials.forEach(mat => {
          const key = mat.item_no
          if (!aggregated[key]) {
            aggregated[key] = {
              item_no: mat.item_no,
              class: mat.class,
              description: mat.description || mat.description2,
              qty_required: 0,
              onhand: mat.onhand, // Take first onhand value
              shortage_qty: 0,
              prod_date_earliest: mat.prod_date,
              prod_date_latest: mat.prod_date
            }
          }
          aggregated[key].qty_required += mat.qty_required
          aggregated[key].shortage_qty += mat.shortage_qty
          if (mat.prod_date < aggregated[key].prod_date_earliest) {
            aggregated[key].prod_date_earliest = mat.prod_date
          }
          if (mat.prod_date > aggregated[key].prod_date_latest) {
            aggregated[key].prod_date_latest = mat.prod_date
          }
        })
        
        // Convert to array and sort by shortage quantity descending
        const materialsArray = Object.values(aggregated)
          .sort((a, b) => b.shortage_qty - a.shortage_qty)
          .slice(0, 20) // Limit to top 20 shortages
        
        setMaterialDetails(prev => ({ ...prev, [jobId]: materialsArray }))
      }
    } catch (error) {
      console.error(`Failed to fetch materials for job ${jobId}:`, error)
    } finally {
      setLoadingDetails(prev => ({ ...prev, [jobId]: false }))
    }
  }

  const toggleExpanded = (jobId) => {
    const willExpand = !expandedJobs[jobId]
    setExpandedJobs(prev => ({ ...prev, [jobId]: willExpand }))
    if (willExpand) {
      fetchMaterialDetails(jobId)
    }
  }

  // Derive material shortage alerts from jobs using source-of-truth flags/text
  const shortages = useMemo(() => {
    if (!jobs || jobs.length === 0) return []
    const alerts = []
    jobs.forEach((job) => {
      const info = getShortageInfo(job, importStats)
      if (info.shortageFlag) {
        const materialItem = job.MaterialItem || job.material_item
        const shortQtyRaw = job.MaterialShortQty ?? job.material_short_qty
        const qtyRemaining = parseFloat(job.QtyReleased || 0) - parseFloat(job.QtyCompleted || 0)
        const hasMaterialShortQty = Number.isFinite(Number(shortQtyRaw)) && Number(shortQtyRaw) > 0
        const qtyNeeded = hasMaterialShortQty
          ? Math.max(0, Math.ceil(Number(shortQtyRaw)))
          : materialItem
            ? null
            : isNaN(qtyRemaining)
              ? null
              : Math.max(0, Math.ceil(qtyRemaining))
        const daysUntilDue = job.DueDate ? Math.ceil((new Date(job.DueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
        alerts.push({
          id: `shortage-${job.Job}`,
          job: job.Job,
          part: materialItem || job.Part || 'Unknown Part',
          workCenter: job.WorkCenter,
          qtyNeeded,
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
          <p>Material shortage signals not included in this snapshot</p>
        </div>
      </div>
    )
  }

  if (shortages.length === 0) {
    return (
      <div className="material-shortage-panel">
        <h3>Material Shortages</h3>
        <div className="empty-state">
          <p>No material shortages flagged in this snapshot</p>
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
        {shortages.map((shortage) => {
          const isExpanded = expandedJobs[shortage.job]
          const details = materialDetails[shortage.job] || []
          const isLoading = loadingDetails[shortage.job]
          
          return (
            <div key={shortage.id} className={`shortage-card ${shortage.severity}`}>
              <div className="shortage-header" onClick={() => toggleExpanded(shortage.job)} style={{ cursor: 'pointer' }}>
                <div className="shortage-job">
                  Job {shortage.job}
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
                <div className={`shortage-severity ${shortage.severity}`}>
                  {shortage.severity === 'critical' ? 'URGENT' : shortage.severity === 'warning' ? 'WARNING' : 'WATCH'}
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
                  <span className="shortage-value shortage-qty">
                    {shortage.qtyNeeded === null || shortage.qtyNeeded === undefined
                      ? '—'
                      : `${shortage.qtyNeeded} units`}
                  </span>
                </div>
                <div className="shortage-row">
                  <span className="shortage-label">Order By:</span>
                  <span className="shortage-value shortage-date">
                    {formatDate(shortage.dueDate)} ({shortage.daysUntilDue} days)
                  </span>
                </div>
              </div>
              
              {isExpanded && (
                <div className="material-breakdown">
                  <h4>Material Requirements Detail (Top 20 Shortages)</h4>
                  {isLoading && <div className="loading-materials">Loading materials...</div>}
                  {!isLoading && details.length === 0 && (
                    <div className="no-materials">No detailed material data available</div>
                  )}
                  {!isLoading && details.length > 0 && (
                    <table className="materials-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Description</th>
                          <th>Total Req.</th>
                          <th>On Hand</th>
                          <th>Short</th>
                          <th>Date Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((material, idx) => {
                          const dateRange = material.prod_date_earliest === material.prod_date_latest
                            ? formatDate(material.prod_date_earliest)
                            : `${formatDate(material.prod_date_earliest)} - ${formatDate(material.prod_date_latest)}`
                          
                          const formatQty = (qty) => {
                            if (qty === null || qty === undefined) return '—'
                            const num = Number(qty)
                            if (!Number.isFinite(num)) return '—'
                            return num.toFixed(4)
                          }
                          
                          return (
                            <tr key={`${material.item_no}-${idx}`} className={material.shortage_qty > 0 ? 'has-shortage' : ''}>
                              <td className="item-no">{material.item_no}</td>
                              <td className="material-desc" title={material.description}>{material.description || '—'}</td>
                              <td className="qty-required">{formatQty(material.qty_required)}</td>
                              <td className="qty-onhand">{formatQty(material.onhand)}</td>
                              <td className="qty-short">{material.shortage_qty > 0 ? formatQty(material.shortage_qty) : '—'}</td>
                              <td className="prod-date">{dateRange}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
