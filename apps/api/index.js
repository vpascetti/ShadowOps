import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import Papa from 'papaparse'
import { isIQMSScheduleSummaryV1, importIQMSScheduleSummaryV1 } from './iqms_importer.js'
import { normalizeCsvPayload, CSV_SCHEMA_VERSION } from './csv_contract.js'
import { normalizeCsvRows, HEADER_ALIASES } from './shadowops_normalizer.js'
import { initDB, query, getTenantIdByToken, ensureDemoTenantAndToken, upsertJob, pool } from './db.js'

dotenv.config()

const app = express()
const port = parseInt(process.env.PORT || '5050', 10)

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json())

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// Tenant token auth middleware
async function requireTenant(req, res, next) {
  const token = req.header('x-tenant-token')
  if (!token) return res.status(401).json({ ok: false, error: 'Missing x-tenant-token' })
  const tenantId = await getTenantIdByToken(token)
  if (!tenantId) return res.status(403).json({ ok: false, error: 'Invalid or revoked token' })
  req.tenantId = tenantId
  next()
}

// Sync status endpoint
app.get('/api/sync/status', requireTenant, async (req, res) => {
  const { tenantId } = req
  const stat = await query(
    `SELECT MAX(ingested_at) as lastIngestedAt, COUNT(*) as jobCount FROM jobs WHERE tenant_id = $1`,
    [tenantId]
  )
  res.json({
    ok: true,
    tenantId,
    lastIngestedAt: stat.rows[0].lastingestedat || null,
    jobCount: parseInt(stat.rows[0].jobcount, 10) || 0
  })
})

// Fetch jobs for tenant
app.get('/api/jobs', requireTenant, async (req, res) => {
  const { tenantId } = req
  const sql = `SELECT job_id, job, work_center, customer, part, start_date, due_date, qty_released, qty_completed, hours_to_go, parts_to_go, prod_start_time, prod_end_time, eplant_id, eplant_company, origin, firm, reason, root_cause, accountable, projected, timeline, status FROM jobs WHERE tenant_id = $1 ORDER BY due_date ASC NULLS LAST`
  const result = await query(sql, [tenantId])
  res.json({ ok: true, jobs: result.rows })
})

// Demo mode: fetch jobs without authentication (uses demo tenant)
app.get('/api/demo/jobs', async (req, res) => {
  const { tenantId } = await ensureDemoTenantAndToken()
  const sql = `SELECT job_id, job, work_center, customer, part, start_date, due_date, qty_released, qty_completed, hours_to_go, parts_to_go, prod_start_time, prod_end_time, eplant_id, eplant_company, origin, firm, reason, root_cause, accountable, projected, timeline, status FROM jobs WHERE tenant_id = $1 ORDER BY due_date ASC NULLS LAST`
  const result = await query(sql, [tenantId])
  res.json({ ok: true, jobs: result.rows })
})

// Ingest jobs for tenant
app.post('/api/ingest/jobs', requireTenant, async (req, res) => {
  const { tenantId } = req
  const jobs = Array.isArray(req.body.jobs) ? req.body.jobs : []
  let inserted = 0, updated = 0
  if (!jobs.length) return res.status(400).json({ ok: false, error: 'No jobs provided' })
  const client = await query('BEGIN') && (await query('BEGIN'))
  try {
    for (const job of jobs) {
      if (!job.job_id || !job.job) continue
      // Upsert job
      await upsertJob(tenantId, job)
      // TODO: count inserted/updated separately if needed
      inserted++
    }
    await query('COMMIT')
    const total = await query('SELECT COUNT(*) FROM jobs WHERE tenant_id = $1', [tenantId])
    res.json({ ok: true, inserted, updated, total: parseInt(total.rows[0].count, 10) })
  } catch (err) {
    await query('ROLLBACK')
    res.status(500).json({ ok: false, error: err.message })
  }
})

// CSV upload endpoint (demo/local mode - uses demo tenant)
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No file uploaded' })
  }

  // Get or create demo tenant
  const { tenantId } = await ensureDemoTenantAndToken()
  const csvStr = req.file.buffer.toString('utf8')

  // DELETE all previous jobs for this tenant before ingesting new ones
  try {
    await query('DELETE FROM jobs WHERE tenant_id = $1', [tenantId])
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to clear previous jobs', details: err.message })
  }
  
  // Parse CSV
  let jobs = [], warnings = [], errors = [], totalRows = 0, source = 'Unknown', snapshotTimestamp = new Date().toISOString()
  let importer = '', detectedHeaders = [], normalizedHeaders = [], sampleJobs = [], recognizedColumns = []
  let unknownColumns = [], schemaVersion = 'ShadowOps-1.0'
  let importStats = {}
  
  try {
    const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true })
    const headers = parsed.meta.fields || []
    const rawRows = parsed.data || []
    
    // Try IQMS Schedule Summary V1 detection first
    if (isIQMSScheduleSummaryV1(headers)) {
      const result = importIQMSScheduleSummaryV1(csvStr)
      // Map IQMS fields to standard job format
      jobs = result.jobs.map(j => ({
        job_id: isNaN(parseInt(j.jobId)) ? Math.abs(String(j.jobId).split('').reduce((s,c)=>Math.imul(31,s)+c.charCodeAt(0)|0,0)) : parseInt(j.jobId),
        job: j.jobId,
        work_center: j.workCenter || null,
        customer: j.customer || null,
        part: j.part || null,
        start_date: j.startDate ? new Date(j.startDate) : null,
        due_date: j.dueDate ? new Date(j.dueDate) : null,
        hours_to_go: typeof j.hoursToGo === 'number' ? j.hoursToGo : null,
        parts_to_go: typeof j.partsToGo === 'number' ? j.partsToGo : null,
        qty_released: j.qtyReleased || null,
        qty_completed: j.qtyCompleted || null,
        reason: null,
        root_cause: null,
        accountable: null
      })).map(job => {
        if (!job.start_date && job.due_date && typeof job.hours_to_go === 'number') {
          const ms = job.due_date.getTime() - job.hours_to_go * 60 * 60 * 1000
          job.start_date = new Date(ms)
        }
        return job
      })
      warnings = result.warnings
      totalRows = result.totalRows
      source = 'IQMS Schedule Summary (CSV)'
      importer = result.importer
      detectedHeaders = result.detectedHeaders
      normalizedHeaders = result.normalizedHeaders
      sampleJobs = result.sampleJobs
      schemaVersion = 'IQMS-1.0'
      unknownColumns = result.unknownColumns || []
      importStats = {
        rowsLoaded: totalRows,
        rowsKept: jobs.length,
        rowsDropped: totalRows - jobs.length,
        duplicatesRemoved: 0,
        dropReasons: {}
      }
    } else {
      // Use new ShadowOps Export normalization
      const result = normalizeCsvRows(rawRows, headers, { dedupe: true })
      
      warnings = result.warnings || []
      errors = result.errors || []
      totalRows = rawRows.length
      recognizedColumns = result.recognizedColumns || []
      unknownColumns = result.unknownColumns || []
      normalizedHeaders = result.normalizedHeaders || headers
      importStats = result.stats || {}
      
      if (errors.length) {
        return res.status(400).json({
          ok: false,
          errors,
          warnings,
          source: 'ShadowOps Export',
          importer: 'SHADOWOPS_EXPORT_V1',
          detectedHeaders: headers,
          recognizedColumns,
          normalizedHeaders,
          unknownColumns,
          schemaVersion,
          totalRows,
          jobsImported: 0,
          importStats
        })
      }
      
      // Convert normalized rows to job format
      // Group by job to collapse operations
      const jobMap = new Map()
      
      result.normalizedRows.forEach(row => {
        const jobKey = row.workOrderId || row.job
        
        if (!jobMap.has(jobKey)) {
          // Create new job entry
          const jobId = row.workOrderId || Math.abs(String(row.job).split('').reduce((s,c)=>Math.imul(31,s)+c.charCodeAt(0)|0,0))
          
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
            operations: []
          })
        }
        
        // Track operation
        const job = jobMap.get(jobKey)
        job.operations.push({
          workCenter: row.workCenter,
          operationSeq: row.operationSeq,
          startTime: row.startTime,
          endTime: row.endTime,
          hoursToGo: row.hoursToGo
        })
        
        // Update job-level fields with latest/best info
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
      
      jobs = Array.from(jobMap.values()).map(job => {
        // Remove operations array before storing
        const { operations, ...jobData } = job
        return jobData
      })
      
      source = 'ShadowOps Export'
      importer = 'SHADOWOPS_EXPORT_V1'
      detectedHeaders = headers
      unknownColumns = unknownColumns || []
      sampleJobs = jobs.slice(0, 3)
    }
  } catch (err) {
    console.error('CSV parse error:', err)
    return res.status(400).json({ ok: false, error: 'CSV parse error', details: err.message })
  }

  // Insert jobs into database
  let inserted = 0, updated = 0
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const job of jobs) {
      if (!job.job_id || !job.job) continue
      
      // Ensure root_cause and accountable are never hard-coded
      const reason = job.reason || null
      const rootCause = job.root_cause || null  // Will be null if not in CSV
      const accountable = job.accountable || null  // Will be null if not in CSV
      
      // Upsert job
      const existRes = await client.query('SELECT id FROM jobs WHERE tenant_id = $1 AND job = $2', [tenantId, job.job])
      if (existRes.rowCount > 0) {
        await client.query(
          `UPDATE jobs SET job_id=$1, work_center=$2, customer=$3, part=$4, start_date=$5, due_date=$6, qty_released=$7, qty_completed=$8, hours_to_go=$9, parts_to_go=$10, prod_start_time=$11, prod_end_time=$12, reason=$13, root_cause=$14, accountable=$15, projected=$16, timeline=$17, status=$18 WHERE tenant_id=$19 AND job=$20`,
          [job.job_id, job.work_center, job.customer, job.part, job.start_date || null, job.due_date || null, job.qty_released, job.qty_completed, job.hours_to_go, job.parts_to_go, job.prod_start_time, job.prod_end_time, reason, rootCause, accountable, job.projected, job.timeline, job.status, tenantId, job.job]
        )
        updated++
      } else {
        await client.query(
          `INSERT INTO jobs (tenant_id, job_id, job, work_center, customer, part, start_date, due_date, qty_released, qty_completed, hours_to_go, parts_to_go, prod_start_time, prod_end_time, reason, root_cause, accountable, projected, timeline, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [tenantId, job.job_id, job.job, job.work_center, job.customer, job.part, job.start_date || null, job.due_date || null, job.qty_released, job.qty_completed, job.hours_to_go, job.parts_to_go, job.prod_start_time, job.prod_end_time, reason, rootCause, accountable, job.projected, job.timeline, job.status]
        )
        inserted++
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('CSV ingest error:', err)
    return res.status(500).json({ ok: false, error: err.message })
  } finally {
    client.release()
  }

  res.json({
    ok: true,
    inserted,
    updated,
    totalRows,
    jobsImported: jobs.length,
    warnings,
    errors,
    source,
    snapshotTimestamp,
    importer,
    detectedHeaders,
    normalizedHeaders: normalizedHeaders.length ? normalizedHeaders : headers,
    recognizedColumns,
    unknownColumns,
    schemaVersion,
    sampleJobs,
    importStats
  })
})

// ...existing inventory endpoints and error handler...

// Inventory endpoints
app.get('/api/inventory', async (req, res) => {
  try {
    const sql = `SELECT id, sku, part, location, qty_on_hand, min_threshold, max_threshold, to_char(created_at,'YYYY-MM-DD HH24:MI:SS') as created_at, to_char(updated_at,'YYYY-MM-DD HH24:MI:SS') as updated_at FROM inventory ORDER BY sku`;
    const result = await query(sql)
    // compute status for each item
    const items = result.rows.map((r) => {
      const qty = parseFloat(r.qty_on_hand || 0)
      const min = parseFloat(r.min_threshold || 0)
      const max = parseFloat(r.max_threshold || 0)
      let status = 'ok'
      if (!isNaN(min) && qty < min) status = 'under'
      if (!isNaN(max) && qty > max) status = 'over'
      return { ...r, qty_on_hand: qty, min_threshold: min, max_threshold: max, status }
    })
    res.json({ ok: true, inventory: items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/inventory', async (req, res) => {
  try {
    const { sku, part, location, qty_on_hand, min_threshold, max_threshold } = req.body
    if (!sku) return res.status(400).json({ ok: false, error: 'sku required' })
    const sql = `INSERT INTO inventory (sku, part, location, qty_on_hand, min_threshold, max_threshold) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;
    const vals = [sku, part || null, location || null, qty_on_hand || 0, min_threshold || 0, max_threshold || 0]
    const result = await query(sql, vals)
    res.json({ ok: true, id: result.rows[0].id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { sku, part, location, qty_on_hand, min_threshold, max_threshold } = req.body
    if (!id) return res.status(400).json({ ok: false, error: 'invalid id' })
    const sql = `UPDATE inventory SET sku=$1, part=$2, location=$3, qty_on_hand=$4, min_threshold=$5, max_threshold=$6 WHERE id=$7`;
    const vals = [sku, part || null, location || null, qty_on_hand || 0, min_threshold || 0, max_threshold || 0, id]
    await query(sql, vals)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Adjust quantity and return updated status and suggested action
app.post('/api/inventory/:id/adjust', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { delta } = req.body
    if (!id || typeof delta === 'undefined') return res.status(400).json({ ok: false, error: 'id and delta required' })
    // perform update returning values
    const upd = await query(`UPDATE inventory SET qty_on_hand = qty_on_hand + $1 WHERE id=$2 RETURNING id, sku, part, qty_on_hand, min_threshold, max_threshold`, [delta, id])
    if (upd.rowCount === 0) return res.status(404).json({ ok: false, error: 'not found' })
    const row = upd.rows[0]
    const qty = parseFloat(row.qty_on_hand || 0)
    const min = parseFloat(row.min_threshold || 0)
    const max = parseFloat(row.max_threshold || 0)
    let status = 'ok'
    let suggested = null
    if (!isNaN(min) && qty < min) {
      status = 'under'
      suggested = 'order'
    }
    if (!isNaN(max) && qty > max) {
      status = 'over'
      suggested = 'dispose_or_transfer'
    }
    res.json({ ok: true, item: { id: row.id, sku: row.sku, part: row.part, qty_on_hand: qty, min_threshold: min, max_threshold: max, status, suggested } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Global error handler to ensure JSON responses on unexpected errors
app.use((err, req, res, next) => {
  console.error('Unhandled server error', err)
  if (res.headersSent) return next(err)
  res.status(500).json({ ok: false, error: err?.message || 'Internal server error' })
})

// Global process error logging
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Start

// Bootstrap demo tenant and print token if created
initDB()
  .then(async () => {
    const { rawToken } = await ensureDemoTenantAndToken()
    app.listen(port, () => {
      console.log(`ShadowOps backend listening on port ${port}`)
      if (rawToken) {
        console.log('Demo tenant token (save this for VITE_TENANT_TOKEN):', rawToken)
      }
    })
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err)
    process.exit(1)
  })
