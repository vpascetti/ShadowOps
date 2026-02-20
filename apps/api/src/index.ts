import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { getProvider } from './providers/index.js'
import type { RealtimePartNumber, JobMaterialDetail } from './providers/iqmsOracleProvider.js'
import { ensureDemoTenantAndToken, initDB, pool } from '../db.js'
import { startSnapshotService } from '../snapshot-service.js'
import { enrichJobWithPredictions, getWorkCenterAnomalies } from '../forecast-enrichment.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 5050)
const provider = getProvider()

const deriveJobId = (jobValue: unknown) => {
  const parsed = parseInt(String(jobValue), 10)
  if (!Number.isNaN(parsed)) return parsed
  return Math.abs(
    String(jobValue || '')
      .split('')
      .reduce((sum, char) => (Math.imul(31, sum) + char.charCodeAt(0)) | 0, 0)
  )
}

app.use(cors())
app.use(express.json())

// Prevent API response caching
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
})

const handleHealth = (_req, res) => {
  res.json({
    ok: true,
    version: 'v1',
    provider: process.env.DATA_PROVIDER || 'stub'
  })
}

app.get('/health', handleHealth)
app.get('/api/health', handleHealth)

const handleJobsRequest = async (req, res) => {
  try {
    const jobs = await provider.getJobs({
      status: req.query.status ? String(req.query.status) : undefined,
      dueDateStart: req.query.dueDateStart ? String(req.query.dueDateStart) : undefined,
      dueDateEnd: req.query.dueDateEnd ? String(req.query.dueDateEnd) : undefined,
      resourceId: req.query.resourceId ? String(req.query.resourceId) : undefined
    })

    res.json({ ok: true, jobs })
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/jobs', handleJobsRequest)
app.get('/api/jobs', handleJobsRequest)
app.get('/demo/jobs', handleJobsRequest)
app.get('/api/demo/jobs', handleJobsRequest)

const handleJobDetail = async (req, res) => {
  try {
    const detail = await provider.getJobById(req.params.id)
    if (!detail) {
      return res.status(404).json({ ok: false, error: 'Job not found' })
    }
    return res.json({ ok: true, ...detail })
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/jobs/:id', handleJobDetail)
app.get('/api/jobs/:id', handleJobDetail)

const handleMetricsSummary = async (_req, res) => {
  try {
    const metrics = await provider.getMetricsSummary()
    res.json({ ok: true, metrics })
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/metrics/summary', handleMetricsSummary)
app.get('/api/metrics/summary', handleMetricsSummary)

const handleFinancialSummary = async (req, res) => {
  try {
    // Set a 10-second timeout for the query
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('Financial summary query timeout - taking too long')), 10000)
    })

    // Fetch all jobs to calculate financial metrics (race against timeout)
    const jobs = await Promise.race([
      provider.getJobs({}),
      timeoutPromise
    ])

    // Calculate average unit price from jobs with pricing data
    const jobsWithPrice = jobs.filter((j: any) => j.unit_price && j.unit_price > 0)
    const avgUnitPrice = jobsWithPrice.length > 0 
      ? jobsWithPrice.reduce((sum: number, j: any) => sum + (parseFloat(j.unit_price) || 0), 0) / jobsWithPrice.length
      : 0

    // Calculate metrics based on available Job fields
    const totalJobs = jobs.length
    const completedJobs = jobs.filter((j: any) => j.status === 'closed').length
    const totalRemainingWork = jobs.reduce((sum: number, j: any) => sum + (parseFloat(j.remaining_work) || 0), 0)

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const overdueCount = jobs.filter((j: any) => {
      const dueDate = j.due_date ? new Date(j.due_date) : null
      return dueDate && dueDate < now
    }).length

    const dueSoonCount = jobs.filter((j: any) => {
      const dueDate = j.due_date ? new Date(j.due_date) : null
      return dueDate && dueDate >= now && dueDate <= sevenDaysFromNow
    }).length

    const atRiskJobs = jobs.filter((j: any) => j.risk_score >= 70)
    
    // Calculate revenue at risk using actual order values
    const revenueAtRisk = atRiskJobs.reduce((sum: number, j: any) => {
      const orderValue = parseFloat(j.total_order_value) || 0
      return sum + orderValue
    }, 0)
    
    // Calculate delayed order impact using actual order values
    const delayedOrderImpact = jobs
      .filter((j: any) => {
        const dueDate = j.due_date ? new Date(j.due_date) : null
        return dueDate && (dueDate < now || (dueDate >= now && dueDate <= sevenDaysFromNow))
      })
      .reduce((sum: number, j: any) => {
        const orderValue = parseFloat(j.total_order_value) || 0
        return sum + orderValue
      }, 0)

    // WIP value calculation (for jobs in progress)
    const wipValue = jobs
      .filter((j: any) => j.status !== 'closed')
      .reduce((sum: number, j: any) => {
        const orderValue = parseFloat(j.total_order_value) || 0
        return sum + orderValue
      }, 0)
    
    const onTimeDeliveryPct = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0
    
    // Calculate total quantity from actual orders
    const totalQtyOrdered = jobs.reduce((sum: number, j: any) => {
      const qty = parseFloat(j.mfg_quantity) || parseFloat(j.ship_quantity) || 0
      return sum + qty
    }, 0)
    
    // Calculate total order value from jobs with pricing
    const totalOrderValue = jobs.reduce((sum: number, j: any) => {
      const orderValue = parseFloat(j.total_order_value) || 0
      return sum + orderValue
    }, 0)

    res.json({
      ok: true,
      dataSource: 'live',
      summary: {
        revenueAtRisk: parseFloat(revenueAtRisk.toFixed(2)),
        delayedOrderImpact: parseFloat(delayedOrderImpact.toFixed(2)),
        wipValue: parseFloat(wipValue.toFixed(2)),
        totalOrderValue: parseFloat(totalOrderValue.toFixed(2)),
        onTimeDeliveryPct: parseFloat(onTimeDeliveryPct.toFixed(2)),
        throughput: 0 // Not available in current schema
      },
      metrics: {
        totalJobs,
        completedJobs,
        totalRemainingWork: parseFloat(totalRemainingWork.toFixed(2)),
        overdueCount,
        dueSoonCount,
        atRiskCount: atRiskJobs.length,
        jobsWithPricing: jobsWithPrice.length,
        avgUnitPrice: parseFloat(avgUnitPrice.toFixed(2)),
        totalQtyOrdered: parseFloat(totalQtyOrdered.toFixed(2))
      }
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/financial-summary', handleFinancialSummary)
app.get('/api/financial-summary', handleFinancialSummary)

const handleRealtime = async (_req, res) => {
  try {
    const realtime = (provider as { getRealtimePartNumbers?: () => Promise<RealtimePartNumber[]> })
      .getRealtimePartNumbers
    if (!realtime) {
      return res.json({ ok: true, data: [] })
    }
    const data = await realtime()
    return res.json({ ok: true, data })
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/realtime/part-numbers', handleRealtime)
app.get('/api/realtime/part-numbers', handleRealtime)

const handleJobMaterials = async (req, res) => {
  try {
    const getMaterials = (provider as { getJobMaterialsDetail?: (jobId: string) => Promise<JobMaterialDetail[]> })
      .getJobMaterialsDetail
    if (!getMaterials) {
      return res.json({ ok: true, materials: [] })
    }
    const materials = await getMaterials(req.params.id)
    return res.json({ ok: true, materials })
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message })
  }
}

app.get('/jobs/:id/materials', handleJobMaterials)
app.get('/api/jobs/:id/materials', handleJobMaterials)

// ================ PREDICTIVE ANALYTICS ENDPOINTS ================

// Get anomalies for all work centers (dashboard view)
app.get('/api/anomalies/dashboard', async (_req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const anomalies = await getWorkCenterAnomalies(tenantId, 'ALL', 30)
    return res.json({ ok: true, anomalies })
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message })
  }
})

const start = async () => {
  await initDB()
  const { tenantId } = await ensureDemoTenantAndToken()
  
  // Start snapshot recording service (every 15 minutes)
  startSnapshotService(tenantId, 15)
  
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`ShadowOps backend listening on ${port}`)
    console.log('[Predictive Analytics] Snapshot service started - recording every 15 minutes')
  })
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', error)
  process.exit(1)
})
