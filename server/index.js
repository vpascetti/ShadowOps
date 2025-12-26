import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import Papa from 'papaparse'
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
  const sql = `SELECT job_id, job, work_center, start_date, due_date, qty_released, qty_completed, hours_to_go, parts_to_go, prod_start_time, prod_end_time, eplant_id, eplant_company, origin, firm FROM jobs WHERE tenant_id = $1 ORDER BY due_date ASC NULLS LAST`
  const result = await query(sql, [tenantId])
  res.json({ ok: true, jobs: result.rows })
})

// Demo mode: fetch jobs without authentication (uses demo tenant)
app.get('/api/demo/jobs', async (req, res) => {
  const { tenantId } = await ensureDemoTenantAndToken()
  const sql = `SELECT job_id, job, work_center, start_date, due_date, qty_released, qty_completed, hours_to_go, parts_to_go, prod_start_time, prod_end_time, eplant_id, eplant_company, origin, firm FROM jobs WHERE tenant_id = $1 ORDER BY due_date ASC NULLS LAST`
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
  const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true })
  const rows = parsed.data || []

  let inserted = 0
  let updated = 0

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const rawRow of rows) {
      const row = {}
      // Normalize keys (trim)
      for (const k of Object.keys(rawRow)) {
        row[k.trim()] = typeof rawRow[k] === 'string' ? rawRow[k].trim() : rawRow[k]
      }

      const job = row['Job'] || row['job']
      if (!job) continue

      const part = row['Part'] || row['part'] || null
      const customer = row['Customer'] || row['customer'] || null
      const work_center = row['WorkCenter'] || row['work_center'] || null

      const start_date_raw = row['StartDate'] || row['start_date'] || null
      const due_date_raw = row['DueDate'] || row['due_date'] || null

      const start_date = start_date_raw ? new Date(start_date_raw) : null
      const due_date = due_date_raw ? new Date(due_date_raw) : null

      const qty_released = row['QtyReleased'] || row['qty_released'] || null
      const qty_completed = row['QtyCompleted'] || row['qty_completed'] || null

      const qtyReleasedNum = qty_released ? parseFloat(String(qty_released).replace(/[^0-9.-]+/g, '')) : null
      const qtyCompletedNum = qty_completed ? parseFloat(String(qty_completed).replace(/[^0-9.-]+/g, '')) : null

      // Generate job_id: try parsing as int, otherwise hash the job string
      let job_id = parseInt(job)
      if (isNaN(job_id)) {
        // Simple hash function for string job IDs
        job_id = Math.abs(String(job).split('').reduce((s,c)=>Math.imul(31,s)+c.charCodeAt(0)|0,0))
      }
      
      // Check if exists for this tenant
      const existRes = await client.query('SELECT id FROM jobs WHERE tenant_id = $1 AND job = $2', [tenantId, job])
      if (existRes.rowCount > 0) {
        await client.query(
          `UPDATE jobs SET job_id=$1, work_center=$2, start_date=$3, due_date=$4, qty_released=$5, qty_completed=$6 WHERE tenant_id=$7 AND job=$8`,
          [job_id, work_center, start_date || null, due_date || null, qtyReleasedNum, qtyCompletedNum, tenantId, job]
        )
        updated += 1
      } else {
        await client.query(
          `INSERT INTO jobs (tenant_id, job_id, job, work_center, start_date, due_date, qty_released, qty_completed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [tenantId, job_id, job, work_center, start_date || null, due_date || null, qtyReleasedNum, qtyCompletedNum]
        )
        inserted += 1
      }
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('CSV ingest error', err)
    return res.status(500).json({ ok: false, error: err.message })
  } finally {
    client.release()
  }

  res.json({ ok: true, inserted, updated, totalRows: rows.length })
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
