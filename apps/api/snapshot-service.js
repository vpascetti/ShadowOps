/**
 * Snapshot Recording Service
 * 
 * Automatically records job progress snapshots to enable trend analysis
 * and velocity-based forecasting. Runs every 15 minutes by default.
 */

import { query } from './db.js'
import fs from 'fs'

async function recordJobSnapshots(tenantId) {
  try {
    // Get all active jobs for tenant
    const jobsResult = await query(
      `SELECT job_id, hours_to_go, qty_completed, status 
       FROM jobs 
       WHERE tenant_id = $1 AND status != 'Complete'
       LIMIT 1000`,
      [tenantId]
    )

    if (jobsResult.rowCount === 0) {
      console.log(`[Snapshots] No active jobs for tenant ${tenantId}`)
      return 0
    }

    const now = new Date()
    let recorded = 0

    // Record snapshot for each job
    for (const job of jobsResult.rows) {
      try {
        await query(
          `INSERT INTO job_snapshots (tenant_id, snapshot_date, job_id, hours_to_go, qty_completed, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, snapshot_date, job_id) DO UPDATE SET
             hours_to_go = $4, qty_completed = $5, status = $6`,
          [
            tenantId,
            now,
            job.job_id,
            parseFloat(job.hours_to_go) || null,
            parseFloat(job.qty_completed) || null,
            job.status
          ]
        )
        recorded++
      } catch (err) {
        console.error(`[Snapshots] Failed recording snapshot for job ${job.job_id}:`, err.message)
      }
    }

    console.log(`[Snapshots] Recorded ${recorded} snapshots for tenant ${tenantId}`)
    return recorded
  } catch (err) {
    console.error('[Snapshots] Error in recordJobSnapshots:', err)
    return 0
  }
}

async function recordWorkCenterMetrics(tenantId) {
  try {
    // Get all work centers and calculate metrics from current jobs
    const result = await query(
      `SELECT DISTINCT work_center FROM jobs WHERE tenant_id = $1 AND work_center IS NOT NULL`,
      [tenantId]
    )

    if (result.rowCount === 0) {
      return 0
    }

    const now = new Date()
    let recorded = 0

    for (const row of result.rows) {
      const workCenter = row.work_center

      try {
        // Calculate metrics for this work center
        const metricsResult = await query(
          `SELECT 
             COUNT(*) as queue_depth,
             COUNT(CASE WHEN status = 'Late' THEN 1 END) as late_count,
             AVG(CAST(hours_to_go as FLOAT)) as avg_hours_remaining
           FROM jobs 
           WHERE tenant_id = $1 AND work_center = $2 AND status != 'Complete'`,
          [tenantId, workCenter]
        )

        if (metricsResult.rowCount > 0) {
          const metrics = metricsResult.rows[0]
          const queueDepth = parseInt(metrics.queue_depth, 10) || 0
          
          // Simple throughput proxy: jobs completed per hour (estimated from historical data)
          const completedResult = await query(
            `SELECT COUNT(*) as completed_count FROM jobs 
             WHERE tenant_id = $1 AND work_center = $2 AND status = 'Complete'
             AND ingested_at > now() - interval '1 day'`,
            [tenantId, workCenter]
          )
          const completedCount = parseInt(completedResult.rows[0]?.completed_count || 0, 10)
          const throughput = completedCount > 0 ? completedCount / 24 : 0

          await query(
            `INSERT INTO work_center_metrics 
             (tenant_id, work_center, metric_date, throughput, queue_depth)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id, work_center, metric_date) DO UPDATE SET
               throughput = $4, queue_depth = $5`,
            [tenantId, workCenter, now, throughput, queueDepth]
          )
          recorded++
        }
      } catch (err) {
        console.error(`[Metrics] Failed recording metrics for ${workCenter}:`, err.message)
      }
    }

    console.log(`[Metrics] Recorded ${recorded} work center metrics for tenant ${tenantId}`)
    return recorded
  } catch (err) {
    console.error('[Metrics] Error in recordWorkCenterMetrics:', err)
    return 0
  }
}

/**
 * Start the snapshot recording service
 * Records every 15 minutes by default
 */
export function startSnapshotService(tenantId, intervalMinutes = 15) {
  console.log(`[Snapshots] Starting service - recording every ${intervalMinutes} minutes`)

  // Record immediately on startup
  recordJobSnapshots(tenantId).catch(console.error)
  recordWorkCenterMetrics(tenantId).catch(console.error)

  // Then record on interval
  setInterval(async () => {
    await recordJobSnapshots(tenantId).catch(console.error)
    await recordWorkCenterMetrics(tenantId).catch(console.error)
  }, intervalMinutes * 60 * 1000)
}

export { recordJobSnapshots, recordWorkCenterMetrics }
