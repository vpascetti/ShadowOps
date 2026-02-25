/**
 * Shipping Data Service
 * 
 * Manages shipping/delivery data from IQMS and provides:
 * - On-time delivery metrics (true measure of customer satisfaction)
 * - Shipping anomaly detection
 * - Delivery trend analysis
 * - Supply chain visibility
 */

import { query } from './db.js'
import fs from 'fs'

/**
 * Sync shipping data from IQMS into our database
 * Updates with latest shipped orders
 */
export async function syncShippingDataFromIQMS(tenantId, queryIQMSFunc) {
  try {
    const sql = fs.readFileSync('./sql/iqms_shipping.sql', 'utf8')
    const rows = await queryIQMSFunc(sql)
    
    if (!rows || rows.length === 0) {
      console.log('No shipping data found in IQMS')
      return { synced: 0, error: null }
    }

    let synced = 0
    
    for (const row of rows) {
      try {
        await query(
          `INSERT INTO shipments (
            tenant_id, workorder_id, job_id, item_number, description,
            customer_id, customer_name, qty_ordered, qty_shipped,
            actual_ship_date, promised_date, work_order_closed_date,
            tracking_number, shipping_carrier, actual_delivery_date,
            delivery_signature, delivery_status, days_late_or_early,
            shipping_notes, po_number, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT (tenant_id, workorder_id) DO UPDATE SET
            actual_ship_date = $10,
            actual_delivery_date = $15,
            delivery_status = $17,
            days_late_or_early = $18,
            shipping_notes = $19,
            updated_at = now()`,
          [
            tenantId,
            row.WORKORDER_ID,
            row.JOB_ID,
            row.ITEM_NUMBER,
            row.DESCRIPTION,
            row.CUSTOMER_ID,
            row.CUSTOMER_NAME,
            parseFloat(row.QTY_ORDERED || 0),
            parseFloat(row.QTY_SHIPPED || 0),
            row.ACTUAL_SHIP_DATE ? new Date(row.ACTUAL_SHIP_DATE) : null,
            row.PROMISED_DATE ? new Date(row.PROMISED_DATE) : null,
            row.WORK_ORDER_CLOSED_DATE ? new Date(row.WORK_ORDER_CLOSED_DATE) : null,
            row.TRACKING_NUMBER || null,
            row.SHIPPING_CARRIER || null,
            row.ACTUAL_DELIVERY_DATE ? new Date(row.ACTUAL_DELIVERY_DATE) : null,
            row.DELIVERY_SIGNATURE ? true : false,
            row.DELIVERY_STATUS || null,
            parseInt(row.DAYS_LATE_OR_EARLY || 0, 10),
            row.SHIPPING_NOTES || null,
            row.PO_NUMBER || null,
            'iqms'
          ]
        )
        synced++
      } catch (err) {
        console.error(`Error syncing shipment for workorder ${row.WORKORDER_ID}:`, err.message)
        continue
      }
    }

    return { synced, error: null }
  } catch (err) {
    console.error('Error syncing shipping data from IQMS:', err.message)
    return { synced: 0, error: err.message }
  }
}

/**
 * Get on-time delivery metrics for a time period
 */
export async function getOnTimeDeliveryMetrics(tenantId, daysBack = 90) {
  try {
    const result = await query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN delivery_status = 'On Time' THEN 1 ELSE 0 END) as on_time_count,
        SUM(CASE WHEN delivery_status = 'Late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN delivery_status = 'In Transit' THEN 1 ELSE 0 END) as in_transit_count,
        AVG(CASE WHEN actual_delivery_date IS NOT NULL THEN days_late_or_early ELSE NULL END) as avg_days_variance,
        MAX(CASE WHEN actual_delivery_date IS NOT NULL THEN days_late_or_early ELSE NULL END) as max_days_late,
        MIN(CASE WHEN actual_delivery_date IS NOT NULL THEN days_late_or_early ELSE NULL END) as min_days_early
       FROM shipments
       WHERE tenant_id = $1
       AND created_at > now() - interval '1 day' * $2`,
      [tenantId, daysBack]
    )

    const row = result.rows[0]
    const totalOrders = parseInt(row.total_orders || 0, 10)
    const onTimeCount = parseInt(row.on_time_count || 0, 10)
    const lateCount = parseInt(row.late_count || 0, 10)
    const inTransitCount = parseInt(row.in_transit_count || 0, 10)

    return {
      period_days: daysBack,
      total_orders: totalOrders,
      on_time_count: onTimeCount,
      late_count: lateCount,
      in_transit_count: inTransitCount,
      on_time_delivery_percent: totalOrders > 0 ? 
        parseFloat(((onTimeCount / totalOrders) * 100).toFixed(2)) : 0,
      average_days_variance: row.avg_days_variance ? 
        parseFloat(row.avg_days_variance.toFixed(1)) : 0,
      max_days_late: row.max_days_late ? parseInt(row.max_days_late, 10) : 0,
      min_days_early: row.min_days_early ? parseInt(row.min_days_early, 10) : 0
    }
  } catch (err) {
    console.error('Error fetching on-time delivery metrics:', err)
    return null
  }
}

/**
 * Get late shipments (for operations attention)
 */
export async function getLateShipments(tenantId, daysBack = 30) {
  try {
    const result = await query(
      `SELECT
        id, workorder_id, job_id, item_number, description, customer_name,
        promised_date, actual_delivery_date, days_late_or_early, tracking_number,
        shipping_carrier
       FROM shipments
       WHERE tenant_id = $1
       AND delivery_status = 'Late'
       AND actual_delivery_date > now() - interval '1 day' * $2
       ORDER BY days_late_or_early DESC`,
      [tenantId, daysBack]
    )

    return result.rows.map(row => ({
      workorder_id: row.workorder_id,
      job_id: row.job_id,
      customer_name: row.customer_name,
      item: row.item_number,
      promised_date: row.promised_date,
      actual_delivery_date: row.actual_delivery_date,
      days_late: parseInt(row.days_late_or_early, 10),
      tracking_number: row.tracking_number,
      carrier: row.shipping_carrier
    }))
  } catch (err) {
    console.error('Error fetching late shipments:', err)
    return []
  }
}

/**
 * Get shipping status by customer
 */
export async function getShippingStatusByCustomer(tenantId, daysBack = 90) {
  try {
    const result = await query(
      `SELECT
        customer_name,
        COUNT(*) as orders,
        SUM(CASE WHEN delivery_status = 'On Time' THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN delivery_status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN delivery_status = 'In Transit' THEN 1 ELSE 0 END) as in_transit
       FROM shipments
       WHERE tenant_id = $1
       AND created_at > now() - interval '1 day' * $2
       GROUP BY customer_name
       ORDER BY orders DESC`,
      [tenantId, daysBack]
    )

    return result.rows.map(row => ({
      customer: row.customer_name,
      total_orders: parseInt(row.orders || 0, 10),
      on_time: parseInt(row.on_time || 0, 10),
      late: parseInt(row.late || 0, 10),
      in_transit: parseInt(row.in_transit || 0, 10),
      on_time_percent: parseInt(row.orders || 0, 10) > 0 ?
        parseFloat((((row.on_time || 0) / (row.orders || 1)) * 100).toFixed(1)) : 0
    }))
  } catch (err) {
    console.error('Error fetching customer shipping status:', err)
    return []
  }
}

/**
 * Get shipments for a specific job
 */
export async function getJobShipments(tenantId, jobId) {
  try {
    const result = await query(
      `SELECT
        id, job_id, customer_name, qty_shipped, promised_date, 
        actual_delivery_date, delivery_status, days_late_or_early,
        tracking_number, shipping_carrier
       FROM shipments
       WHERE tenant_id = $1 AND job_id = $2
       ORDER BY created_at DESC`,
      [tenantId, jobId]
    )

    return result.rows.map(row => ({
      job_id: row.job_id,
      customer: row.customer_name,
      qty_shipped: parseFloat(row.qty_shipped || 0),
      promised_date: row.promised_date,
      delivered_date: row.actual_delivery_date,
      status: row.delivery_status,
      days_variance: parseInt(row.days_late_or_early || 0, 10),
      tracking: row.tracking_number,
      carrier: row.shipping_carrier
    }))
  } catch (err) {
    console.error(`Error fetching shipments for job ${jobId}:`, err)
    return []
  }
}

/**
 * Detect shipping anomalies
 */
export async function getShippingAnomalies(tenantId, daysBack = 30) {
  try {
    const metrics = await getOnTimeDeliveryMetrics(tenantId, daysBack)
    const anomalies = []

    // Anomaly 1: On-time delivery below 90%
    if (metrics.on_time_delivery_percent < 90) {
      anomalies.push({
        type: 'low_otd',
        severity: metrics.on_time_delivery_percent < 80 ? 'critical' : 'high',
        message: `On-time delivery at ${metrics.on_time_delivery_percent}% (target: 95%)`,
        metric_value: metrics.on_time_delivery_percent,
        threshold: 90,
        recommendation: 'Review shipping delays and work with carriers'
      })
    }

    // Anomaly 2: High average lateness
    if (metrics.average_days_variance > 2) {
      anomalies.push({
        type: 'avg_lateness',
        severity: 'high',
        message: `Average shipments ${metrics.average_days_variance} days late`,
        metric_value: metrics.average_days_variance,
        recommendation: 'Investigate supply chain delays or carrier issues'
      })
    }

    // Anomaly 3: Multiple late shipments
    if (metrics.late_count > metrics.total_orders * 0.15) {
      anomalies.push({
        type: 'high_late_count',
        severity: 'medium',
        message: `${metrics.late_count} late shipments out of ${metrics.total_orders}`,
        metric_value: metrics.late_count,
        recommendation: 'Review delay patterns and address root causes'
      })
    }

    return anomalies
  } catch (err) {
    console.error('Error detecting shipping anomalies:', err)
    return []
  }
}

/**
 * Get shipping forecast (predict days until next batch ships)
 */
export async function getShippingForecast(tenantId, daysAhead = 7) {
  try {
    // Look at historical shipping patterns
    const result = await query(
      `SELECT
        created_at::date as ship_date,
        COUNT(*) as shipments_per_day
       FROM shipments
       WHERE tenant_id = $1
       AND created_at > now() - interval '30 days'
       GROUP BY created_at::date
       ORDER BY created_at DESC`,
      [tenantId]
    )

    if (result.rowCount < 3) {
      return {
        forecast: 'Insufficient data',
        days_ahead: daysAhead,
        recommended_next_batch: null
      }
    }

    // Calculate average shipments per day
    const dates = result.rows.map(r => parseInt(r.shipments_per_day, 10))
    const avgPerDay = dates.reduce((a, b) => a + b, 0) / dates.length

    return {
      forecast: `Expecting ~${Math.round(avgPerDay * daysAhead)} shipments in next ${daysAhead} days`,
      average_shipments_per_day: Math.round(avgPerDay * 10) / 10,
      days_ahead: daysAhead,
      historical_pattern: dates.slice(0, 7).join(' → ')
    }
  } catch (err) {
    console.error('Error forecasting shipments:', err)
    return null
  }
}
/**
 * Calculate ON-TIME REVENUE based on actual shipments
 * 
 * This is the correct way to measure on-time revenue:
 * - Compare ACTUAL_SHIP_DATE to PROMISED_DATE
 * - If shipped <= promise date → counts as ON-TIME REVENUE
 * - A job can be complete but shipped late = LATE REVENUE
 * 
 * @param {string} tenantId - Tenant ID
 * @returns {Object} On-time revenue metrics from shipments
 */
export async function getOnTimeRevenueFromShipments(tenantId) {
  try {
    // Query shipments and join with jobs to get pricing data
    const result = await query(
      `SELECT
        s.job_id,
        s.actual_ship_date,
        s.promised_date,
        s.qty_shipped,
        j.total_order_value,
        j.unit_price,
        CASE 
          WHEN s.actual_ship_date IS NULL THEN 'Not Shipped'
          WHEN s.actual_ship_date::date <= s.promised_date::date THEN 'On Time'
          ELSE 'Late'
        END as ship_status
      FROM shipments s
      LEFT JOIN jobs j ON s.job_id = j.job_id AND j.tenant_id = $1
      WHERE s.tenant_id = $1
        AND s.actual_ship_date IS NOT NULL
      ORDER BY s.actual_ship_date DESC`,
      [tenantId]
    )

    const shipments = result.rows || []
    
    // Calculate revenue by shipping status
    let onTimeRevenue = 0
    let lateRevenue = 0
    let onTimeCount = 0
    let lateCount = 0

    shipments.forEach(shipment => {
      // Use total_order_value if available, otherwise unit_price * qty_shipped
      let revenue = 0
      if (shipment.total_order_value && shipment.total_order_value > 0) {
        revenue = parseFloat(shipment.total_order_value)
      } else if (shipment.unit_price && shipment.qty_shipped) {
        revenue = parseFloat(shipment.unit_price) * parseFloat(shipment.qty_shipped)
      } else if (shipment.qty_shipped) {
        // Fallback: estimate $50/unit if no pricing data available
        revenue = parseFloat(shipment.qty_shipped) * 50
      }

      if (shipment.ship_status === 'On Time') {
        onTimeRevenue += revenue
        onTimeCount++
      } else if (shipment.ship_status === 'Late') {
        lateRevenue += revenue
        lateCount++
      }
    })

    const totalRevenue = onTimeRevenue + lateRevenue
    const onTimePercent = totalRevenue > 0 ? (onTimeRevenue / totalRevenue * 100) : 0

    return {
      on_time_revenue: onTimeRevenue,
      late_revenue: lateRevenue,
      total_shipped_revenue: totalRevenue,
      on_time_shipments: onTimeCount,
      late_shipments: lateCount,
      total_shipments: shipments.length,
      on_time_percent: Math.round(onTimePercent * 10) / 10,
      metric_type: 'shipment_based'
    }
  } catch (err) {
    console.error('Error calculating on-time revenue from shipments:', err)
    return {
      on_time_revenue: 0,
      late_revenue: 0,
      total_shipped_revenue: 0,
      on_time_shipments: 0,
      late_shipments: 0,
      total_shipments: 0,
      on_time_percent: 0,
      error: err.message,
      metric_type: 'shipment_based'
    }
  }
}