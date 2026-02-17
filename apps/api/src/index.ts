import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import Papa from 'papaparse'
import { getProvider } from './providers/index.js'
import { ensureDemoTenantAndToken, initDB, pool } from '../db.js'
import { isIQMSScheduleSummaryV1, importIQMSScheduleSummaryV1 } from '../iqms_importer.js'
import { normalizeCsvRows } from '../shadowops_normalizer.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 5050)
const provider = getProvider()
const upload = multer({ storage: multer.memoryStorage() })

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

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    version: 'v1',
    provider: process.env.DATA_PROVIDER || 'stub'
  })
})

app.get('/jobs', async (req, res) => {
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
})

app.get('/jobs/:id', async (req, res) => {
  try {
    const detail = await provider.getJobById(req.params.id)
    if (!detail) {
      return res.status(404).json({ ok: false, error: 'Job not found' })
    }
    return res.json({ ok: true, ...detail })
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message })
  }
})

app.get('/metrics/summary', async (_req, res) => {
  try {
    const metrics = await provider.getMetricsSummary()
    res.json({ ok: true, metrics })
  } catch (error) {
    res.status(500).json({ ok: false, error: (error as Error).message })
  }
})

app.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' })
  }

  const { tenantId } = await ensureDemoTenantAndToken()
  const csvStr = req.file.buffer.toString('utf8')

  let jobs: Array<Record<string, any>> = []
  let warnings: string[] = []
  let errors: string[] = []
  let totalRows = 0
  let source = 'Unknown'
  let importer = ''
  let detectedHeaders: string[] = []
  let normalizedHeaders: Array<Record<string, unknown> | string> = []
  let unknownColumns: string[] = []
  let schemaVersion = 'ShadowOps-1.0'
  let importStats: Record<string, unknown> = {}

  try {
    const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true })
    const headers = parsed.meta.fields || []
    const rawRows = parsed.data || []
    totalRows = rawRows.length

    if (isIQMSScheduleSummaryV1(headers)) {
      const result = importIQMSScheduleSummaryV1(csvStr)
      jobs = result.jobs.map((job) => {
        const startDate = job.startDate ? new Date(job.startDate) : null
        const dueDate = job.dueDate ? new Date(job.dueDate) : null
        const hoursToGo = typeof job.hoursToGo === 'number' ? job.hoursToGo : null

        return {
          job_id: deriveJobId(job.jobId),
          job: String(job.jobId),
          work_center: job.workCenter || null,
          customer: job.customer || null,
          part: job.part || null,
          start_date: startDate,
          due_date: dueDate,
          hours_to_go: hoursToGo,
          parts_to_go: typeof job.partsToGo === 'number' ? job.partsToGo : null,
          qty_released: job.qtyReleased ?? null,
          qty_completed: job.qtyCompleted ?? null,
          reason: null,
          root_cause: null,
          accountable: null,
          status: 'open'
        }
      })
      warnings = result.warnings
      source = 'IQMS Schedule Summary (CSV)'
      importer = result.importer
      detectedHeaders = result.detectedHeaders
      normalizedHeaders = result.normalizedHeaders
      unknownColumns = result.unknownColumns || []
      schemaVersion = 'IQMS-1.0'
      importStats = {
        rowsLoaded: totalRows,
        rowsKept: jobs.length,
        rowsDropped: totalRows - jobs.length,
        duplicatesRemoved: 0,
        dropReasons: {}
      }
    } else {
      const result = normalizeCsvRows(rawRows, headers, { dedupe: true })
      warnings = result.warnings || []
      errors = result.errors || []
      detectedHeaders = headers
      normalizedHeaders = result.normalizedHeaders || headers
      unknownColumns = result.unknownColumns || []
      importStats = result.stats || {}

      if (errors.length) {
        return res.status(400).json({
          ok: false,
          errors,
          warnings,
          source: 'ShadowOps Export',
          importer: 'SHADOWOPS_EXPORT_V1',
          detectedHeaders: headers,
          normalizedHeaders,
          unknownColumns,
          schemaVersion,
          totalRows,
          jobsImported: 0,
          importStats
        })
      }

      const jobMap = new Map()
      result.normalizedRows.forEach((row) => {
        const jobKey = row.workOrderId || row.job
        if (!jobKey) return

        if (!jobMap.has(jobKey)) {
          const jobId = row.workOrderId || deriveJobId(row.job)
          jobMap.set(jobKey, {
            job_id: jobId,
            job: row.job,
            work_center: row.workCenter,
            customer: row.customer,
            part: row.itemNumber,
            start_date: row.startTime,
            due_date: row.dueDate,
            qty_released: row.qtyReleased ?? row.deliveryQty ?? null,
            qty_completed: row.qtyCompleted ?? row.cyclesToGo ?? null,
            hours_to_go: row.hoursToGo,
            parts_to_go: row.cyclesToGo,
            prod_start_time: row.startTime,
            prod_end_time: row.endTime,
            reason: null,
            root_cause: null,
            accountable: null,
            status: 'open',
            operations: []
          })
        }

        const job = jobMap.get(jobKey)
        job.operations.push({
          workCenter: row.workCenter,
          operationSeq: row.operationSeq,
          startTime: row.startTime,
          endTime: row.endTime,
          hoursToGo: row.hoursToGo
        })

        if (row.dueDate && (!job.due_date || row.dueDate < job.due_date)) {
          job.due_date = row.dueDate
        }
        if (row.startTime && (!job.start_date || row.startTime < job.start_date)) {
          job.start_date = row.startTime
        }
        if (row.endTime && (!job.prod_end_time || row.endTime > job.prod_end_time)) {
          job.prod_end_time = row.endTime
        }
        if (row.hoursToGo !== null && (job.hours_to_go === null || row.hoursToGo > job.hours_to_go)) {
          job.hours_to_go = row.hoursToGo
        }
      })

      jobs = Array.from(jobMap.values()).map((job) => {
        const { operations, ...jobData } = job
        return jobData
      })

      source = 'ShadowOps Export'
      importer = 'SHADOWOPS_EXPORT_V1'
    }
  } catch (error) {
    return res.status(400).json({ ok: false, error: (error as Error).message })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM jobs WHERE tenant_id = $1', [tenantId])

    for (const job of jobs) {
      if (!job.job_id || !job.job) continue

      const values = [
        tenantId,
        job.job_id,
        job.job,
        job.work_center || null,
        job.customer || null,
        job.part || null,
        job.start_date || null,
        job.due_date || null,
        job.qty_released ?? null,
        job.qty_completed ?? null,
        job.hours_to_go ?? null,
        job.parts_to_go ?? null,
        job.prod_start_time || null,
        job.prod_end_time || null,
        job.reason || null,
        job.root_cause || null,
        job.accountable || null,
        job.projected || null,
        job.timeline || null,
        job.status || null
      ]

      await client.query(
        `
          INSERT INTO jobs (
            tenant_id, job_id, job, work_center, customer, part,
            start_date, due_date, qty_released, qty_completed,
            hours_to_go, parts_to_go, prod_start_time, prod_end_time,
            reason, root_cause, accountable, projected, timeline, status
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
          )
          ON CONFLICT (tenant_id, job_id) DO UPDATE SET
            job_id = EXCLUDED.job_id,
            job = EXCLUDED.job,
            work_center = EXCLUDED.work_center,
            customer = EXCLUDED.customer,
            part = EXCLUDED.part,
            start_date = EXCLUDED.start_date,
            due_date = EXCLUDED.due_date,
            qty_released = EXCLUDED.qty_released,
            qty_completed = EXCLUDED.qty_completed,
            hours_to_go = EXCLUDED.hours_to_go,
            parts_to_go = EXCLUDED.parts_to_go,
            prod_start_time = EXCLUDED.prod_start_time,
            prod_end_time = EXCLUDED.prod_end_time,
            reason = EXCLUDED.reason,
            root_cause = EXCLUDED.root_cause,
            accountable = EXCLUDED.accountable,
            projected = EXCLUDED.projected,
            timeline = EXCLUDED.timeline,
            status = EXCLUDED.status,
            ingested_at = now()
        `,
        values
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ ok: false, error: (error as Error).message })
  } finally {
    client.release()
  }

  return res.json({
    ok: true,
    inserted: jobs.length,
    updated: 0,
    totalRows,
    jobsImported: jobs.length,
    warnings,
    errors,
    source,
    importer,
    detectedHeaders,
    normalizedHeaders,
    unknownColumns,
    schemaVersion,
    importStats
  })
})

const start = async () => {
  await initDB()
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`ShadowOps API listening on ${port}`)
  })
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start API', error)
  process.exit(1)
})
