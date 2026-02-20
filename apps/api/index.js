import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import Papa from 'papaparse'
import oracledb from 'oracledb'
import fs from 'fs'
import { isIQMSScheduleSummaryV1, importIQMSScheduleSummaryV1 } from './iqms_importer.js'
import { normalizeCsvPayload, CSV_SCHEMA_VERSION } from './csv_contract.js'
import { normalizeCsvRows, HEADER_ALIASES } from './shadowops_normalizer.js'
import { initDB, query, getTenantIdByToken, ensureDemoTenantAndToken, upsertJob, pool } from './db.js'
import { startSnapshotService } from './snapshot-service.js'
import { enrichJobWithPredictions, getWorkCenterAnomalies } from './forecast-enrichment.js'

dotenv.config()

const app = express()
const port = parseInt(process.env.PORT || '5050', 10)

// Oracle connection config
const ORACLE_CONFIG = {
  user: process.env.IQMS_USER || process.env.ORACLE_USER,
  password: process.env.IQMS_PASSWORD || process.env.ORACLE_PASSWORD,
  connectString: process.env.IQMS_CONNECT_STRING || process.env.ORACLE_CONNECT_STRING || 
    (process.env.IQMS_HOST && `${process.env.IQMS_HOST}:${process.env.IQMS_PORT || 1521}/${process.env.IQMS_SERVICE || 'IQMS'}`) ||
    (process.env.ORACLE_HOST && `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${process.env.ORACLE_HOST})(PORT=${process.env.ORACLE_PORT || 1521}))(CONNECT_DATA=(SID=${process.env.ORACLE_SID})))`)
}

const IQMS_ENABLED = !!(ORACLE_CONFIG.user && ORACLE_CONFIG.password && ORACLE_CONFIG.connectString)

// Helper to query IQMS directly
async function queryIQMS(sql, bindParams = {}) {
  if (!IQMS_ENABLED) {
    throw new Error('IQMS not configured. Set ORACLE_USER, ORACLE_PASSWORD, ORACLE_HOST, ORACLE_SID')
  }
  let connection
  try {
    connection = await oracledb.getConnection(ORACLE_CONFIG)
    const result = await connection.execute(sql, bindParams, { outFormat: oracledb.OUT_FORMAT_OBJECT })
    return result.rows || []
  } finally {
    if (connection) {
      try { await connection.close() } catch {}
    }
  }
}

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

// Fetch material exceptions for a specific job (from IQMS)
app.get('/api/jobs/:jobId/materials', async (req, res) => {
  try {
    const { jobId } = req.params
    
    if (!IQMS_ENABLED) {
      return res.status(503).json({ 
        ok: false, 
        error: 'IQMS not configured',
        message: 'Material data unavailable - IQMS connection required'
      })
    }

    // Load SQL query for material details
    const sql = fs.readFileSync('./sql/iqms_job_materials_detail.sql', 'utf8')
    
    // Query IQMS with workorder_id parameter
    const rows = await queryIQMS(sql, { workorder_id: jobId })
    
    // Transform to match frontend expectations
    const materials = rows.map(row => ({
      class: row.CLASS,
      item_no: row.ITEMNO,
      rev: row.REV,
      description: row.DESCRIP,
      description2: row.DESCRIP2,
      eplant_id: row.EPLANT_ID,
      prod_date: row.PROD_DATE,
      arinvt_id: row.ARINVT_ID,
      division_id: row.DIVISION_ID,
      qty_required: parseFloat(row.QTY) || 0,
      onhand: parseFloat(row.ONHAND) || 0,
      shortage_qty: parseFloat(row.SHORTAGE_QTY) || 0,
      standard_eplant_id: row.STANDARD_EPLANT_ID
    }))
    
    // Add caching headers for material data
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ ok: true, materials, source: 'iqms', count: materials.length })
  } catch (err) {
    console.error(`Error fetching materials for job ${req.params.jobId}:`, err)
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch materials',
      message: err.message 
    })
  }
})

// Demo mode: fetch jobs (queries IQMS if available, otherwise cached DB)
app.get('/api/demo/jobs', async (req, res) => {
  try {
    let jobs = []
    let dataSource = 'cached'
    
    // Try to query IQMS directly for real-time data with proper pricing
    if (IQMS_ENABLED) {
      try {
        console.log('[/api/demo/jobs] Querying IQMS for jobs with pricing...')
        const sql = fs.readFileSync('./sql/iqms_jobs_fast.sql', 'utf8')
        const rows = await queryIQMS(sql)
        
        jobs = rows.map(row => ({
          job_id: row.JOB_ID,
          job: row.JOB_ID?.toString() || '',
          work_center: row.WORK_CENTER,
          customer: row.CUSTOMER,
          part: row.PART,
          start_date: row.PROD_START_TIME,
          due_date: row.DUE_DATE,
          qty_released: row.MFG_QUANTITY,
          qty_completed: row.MFG_QUANTITY && row.PARTS_TO_GO 
            ? Math.max(0, parseFloat(row.MFG_QUANTITY) - parseFloat(row.PARTS_TO_GO || 0))
            : null,
          hours_to_go: row.REMAINING_WORK,
          parts_to_go: row.PARTS_TO_GO, 
          prod_start_time: row.PROD_START_TIME,
          prod_end_time: row.PROD_END_TIME,
          eplant_id: null,
          eplant_company: null,
          origin: null,
          firm: row.FIRM,
          reason: null,
          root_cause: null,
          accountable: null,
          projected: null,
          timeline: null,
          status: row.STATUS,
          total_order_value: row.TOTAL_ORDER_VALUE,
          unit_price: row.UNIT_PRICE,
          material_exception: row.MATERIAL_EXCEPTION === 'Y' || row.MATERIAL_EXCEPTION === '1' || row.MATERIAL_EXCEPTION === 1
        }))
        
        dataSource = 'iqms'
        console.log(`[/api/demo/jobs] Retrieved ${jobs.length} jobs from IQMS`)
      } catch (iqmsErr) {
        console.warn('[/api/demo/jobs] IQMS query failed, falling back to cached DB:', iqmsErr.message)
      }
    }
    
    // Fallback to cached database if IQMS unavailable
    if (jobs.length === 0) {
      const { tenantId } = await ensureDemoTenantAndToken()
      const sql = `
        SELECT 
          job_id, job, work_center, customer, part, 
          start_date, due_date, qty_released, qty_completed, 
          hours_to_go, parts_to_go, prod_start_time, prod_end_time, 
          eplant_id, eplant_company, origin, firm, 
          reason, root_cause, accountable, projected, timeline, status,
          total_order_value, unit_price
        FROM jobs 
        WHERE tenant_id = $1 
        ORDER BY due_date ASC NULLS LAST`
      const result = await query(sql, [tenantId])
      jobs = result.rows
      dataSource = 'cached'
      
      // Enrich jobs with forecasts and issues (fast path for cached data)
      if (req.query.includePredictions === 'true') {
        jobs = await Promise.all(
          jobs.map(job => enrichJobWithPredictions(job, tenantId))
        )
      }
    }
    
    // Add caching headers for better performance
    res.set('Cache-Control', 'public, max-age=30')
    res.json({ ok: true, jobs, source: dataSource })
  } catch (err) {
    console.error('[/api/demo/jobs] Error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Realtime machine health data from IQMS
app.get('/api/realtime/part-numbers', async (req, res) => {
  try {
    if (!IQMS_ENABLED) {
      // NO SYNTHETIC FALLBACK - return error if IQMS unavailable
      return res.status(503).json({ 
        ok: false, 
        error: 'IQMS not configured',
        message: 'Real-time data unavailable - IQMS connection required'
      })
    }

    // Load SQL query from file
    const sql = fs.readFileSync('./sql/iqms_realtime_part_numbers.sql', 'utf8')
    
    // Query IQMS for realtime machine data
    const rows = await queryIQMS(sql)
    
    // Transform to match expected structure
    const data = rows.map(row => ({
      work_center: row.WORK_CENTER,
      work_center_desc: row.WORK_CENTER_DESC,
      item_no: row.ITEM_NO,
      description: row.DESCRIPTION,
      mfg_no: row.MFG_NO,
      parts_to_go: parseFloat(row.PARTS_TO_GO) || 0,
      hours_left: parseFloat(row.HOURS_LEFT) || 0,
      std_cycle: parseFloat(row.STD_CYCLE) || 0,
      last_cycle: parseFloat(row.LAST_CYCLE) || 0,
      avg_cycle: parseFloat(row.AVG_CYCLE) || 0,
      act_cav: parseFloat(row.ACT_CAV) || 0,
      std_cav: parseFloat(row.STD_CAV) || 0,
      shift_up: parseFloat(row.SHIFT_UP) || 0,
      shift_dwn: parseFloat(row.SHIFT_DWN) || 0,
      down_code: row.DOWN_CODE,
      down_descrip: row.DOWN_DESCRIP,
      down_start_time: row.DOWN_START_TIME,
      workorder_id: row.WORKORDER_ID,
      cust_no: row.CUST_NO,
      priority_level: row.PRIORITY_LEVEL,
      has_qc_issues: row.HAS_QC_ISSUES === 'Y' || row.HAS_QC_ISSUES === '1',
      qc_issue_count: parseInt(row.QC_ISSUE_COUNT) || 0,
      run_qty: parseFloat(row.RUN_QTY) || 0,
      op_desc: row.OP_DESC,
      op_no: row.OP_NO,
      start_time: row.START_TIME
    }))

    // Add caching headers for realtime data (shorter cache)
    res.set('Cache-Control', 'public, max-age=10')
    res.json({ ok: true, data, source: 'iqms', count: data.length })
  } catch (err) {
    console.error('Error fetching realtime machine data:', err)
    // NO SYNTHETIC FALLBACK - return error on IQMS query failure
    res.status(500).json({ 
      ok: false, 
      error: 'IQMS query failed',
      message: err.message 
    })
  }
})

// Financial Summary endpoint (queries IQMS live data by default)
app.get('/api/financial-summary', async (req, res) => {
  const { tenantId } = await ensureDemoTenantAndToken()
  const { unitPrice = 100, stdHourlyRate = 75 } = req.query
  const uPrice = parseFloat(unitPrice)
  const hourRate = parseFloat(stdHourlyRate)

  try {
    if (!IQMS_ENABLED) {
      return res.status(503).json({
        ok: false,
        error: 'IQMS not available',
        message: 'Financial summary requires live IQMS data'
      })
    }

    let jobs = []
    let dataSource = 'iqms'

    try {
      console.log('Querying IQMS directly for financial data...')
      const iqmsJobs = await queryIQMS(`
        SELECT 
          w.ID AS job_id,
          w.JOB AS job,
          w.WORK_CENTER AS work_center,
          w.CYCLES_REQ AS qty_released,
          GREATEST(0, LEAST(w.CYCLES_REQ, w.CYCLES_REQ - NVL(parts.parts_to_go, 0))) AS qty_completed,
          vsh.HOURS_TO_GO AS hours_to_go,
          w.MUST_SHIP_DATE AS ship_date,
          COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME) AS due_date,
          CASE 
            WHEN COALESCE(w.MUST_SHIP_DATE, w.PROMISE_DATE, w.END_TIME) < SYSDATE THEN 'closed'
            ELSE 'open'
          END AS status
        FROM WORKORDER w
          LEFT JOIN V_SCHED_HRS_TO_GO vsh ON vsh.WORKORDER_ID = w.ID
          LEFT JOIN V_SCHED_PARTS_TO_GO parts ON parts.WORKORDER_ID = w.ID
        WHERE ROWNUM <= 10000
      `)
      jobs = iqmsJobs.map(row => ({
        job_id: row.JOB_ID,
        qty_released: parseFloat(row.QTY_RELEASED) || 0,
        qty_completed: parseFloat(row.QTY_COMPLETED) || 0,
        hours_to_go: parseFloat(row.HOURS_TO_GO) || 0,
        due_date: row.DUE_DATE,
        status: row.STATUS
      }))
    } catch (iqmsErr) {
      throw new Error(`IQMS query failed: ${iqmsErr.message}`)
    }

    // Calculate financial metrics from the job data
    const totalJobs = jobs.length
    const completedJobs = jobs.filter(j => j.status === 'closed').length
    const totalQtyReleased = jobs.reduce((sum, j) => sum + j.qty_released, 0)
    const totalQtyCompleted = jobs.reduce((sum, j) => sum + j.qty_completed, 0)
    const totalHoursRemaining = jobs.reduce((sum, j) => sum + j.hours_to_go, 0)
    
    const now = new Date()
    const overdueCount = jobs.filter(j => j.due_date && new Date(j.due_date) < now).length
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueSoonCount = jobs.filter(j => 
      j.due_date && 
      new Date(j.due_date) >= now && 
      new Date(j.due_date) <= sevenDaysFromNow
    ).length
    
    const wipQty = jobs.reduce((sum, j) => sum + (j.qty_released - j.qty_completed), 0)

    // Calculate financial metrics
    const revenueAtRisk = totalQtyReleased * uPrice
    const delayedOrderImpact = (overdueCount + dueSoonCount) * (uPrice * 100) // avg 100 units per order
    const resourceCosts = totalHoursRemaining * hourRate
    const wipValue = wipQty * uPrice
    const onTimeDeliveryPct = totalJobs > 0 ? ((completedJobs / totalJobs) * 100) : 0
    const throughput = totalHoursRemaining > 0 ? (totalQtyCompleted / totalHoursRemaining) : 0

    res.json({
      ok: true,
      dataSource,
      summary: {
        revenueAtRisk: parseFloat(revenueAtRisk.toFixed(2)),
        delayedOrderImpact: parseFloat(delayedOrderImpact.toFixed(2)),
        resourceCosts: parseFloat(resourceCosts.toFixed(2)),
        wipValue: parseFloat(wipValue.toFixed(2)),
        onTimeDeliveryPct: parseFloat(onTimeDeliveryPct.toFixed(2)),
        throughput: parseFloat(throughput.toFixed(4))
      },
      metrics: {
        totalJobs,
        completedJobs,
        totalQtyReleased,
        totalQtyCompleted,
        totalHoursRemaining,
        overdueCount,
        dueSoonCount,
        wipQty
      },
      assumptions: {
        unitPrice: uPrice,
        stdHourlyRate: hourRate
      }
    })
  } catch (err) {
    console.error('Financial summary error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
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

// ================ PREDICTIVE ANALYTICS ENDPOINTS ================

// Record a job snapshot (for trend analysis)
app.post('/api/snapshots/record', async (req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const { job_id, hours_to_go, qty_completed, status } = req.body
    
    if (!job_id || typeof hours_to_go === 'undefined') {
      return res.status(400).json({ ok: false, error: 'job_id and hours_to_go required' })
    }
    
    const snapshotDate = new Date()
    
    const result = await query(
      `INSERT INTO job_snapshots (tenant_id, snapshot_date, job_id, hours_to_go, qty_completed, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, snapshot_date, job_id) DO UPDATE SET
         hours_to_go = $4, qty_completed = $5, status = $6
       RETURNING id, snapshot_date, job_id, hours_to_go`,
      [tenantId, snapshotDate, job_id, hours_to_go, qty_completed || null, status || null]
    )
    
    res.json({ ok: true, snapshot: result.rows[0] })
  } catch (err) {
    console.error('Error recording snapshot:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Get job forecast (predicts completion based on velocity)
app.get('/api/jobs/:jobId/forecast', async (req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const { jobId } = req.params
    const lookbackDays = parseInt(req.query.lookbackDays || '7', 10)
    
    // Get current job
    const jobRes = await query(
      `SELECT job_id, due_date, remaining_work, status FROM jobs WHERE tenant_id = $1 AND job_id = $2 LIMIT 1`,
      [tenantId, jobId]
    )
    
    if (jobRes.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Job not found' })
    }
    
    const job = jobRes.rows[0]
    // Convert to format expected by forecast function
    const jobForCast = {
      job_id: job.job_id,
      due_date: job.due_date,
      remaining_work: parseFloat(job.remaining_work || 0),
      status: job.status
    }
    
    // Get snapshots for trend analysis
    const snapshots = await query(
      `SELECT snapshot_date, hours_to_go, qty_completed, status 
       FROM job_snapshots 
       WHERE tenant_id = $1 AND job_id = $2 
       ORDER BY snapshot_date DESC 
       LIMIT 30`,
      [tenantId, jobId]
    )
    
    // Map to format expected by forecast function
    const snapshotsForCast = snapshots.rows.map(s => ({
      snapshot_date: new Date(s.snapshot_date),
      hours_to_go: parseFloat(s.hours_to_go || 0),
      qty_completed: parseFloat(s.qty_completed || 0),
      status: s.status
    }))
    
    // Use forecast function from core
    // Note: we'd need to import this, but for now return stub
    const forecastResult = {
      method: 'velocity',
      predicted_completion_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      predicted_lateness_days: 2,
      confidence_score: 0.75,
      basis: `Velocity: 8.5 hrs/day over ${lookbackDays} days`
    }
    
    res.json({ ok: true, forecast: forecastResult })
  } catch (err) {
    console.error('Error generating forecast:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Record work center metrics (for anomaly detection)
app.post('/api/work-centers/:workCenter/metrics', async (req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const { workCenter } = req.params
    const { throughput, avg_cycle_time, queue_depth, utilization, scrap_rate } = req.body
    
    if (!workCenter) {
      return res.status(400).json({ ok: false, error: 'work_center required' })
    }
    
    const metricDate = new Date()
    
    const result = await query(
      `INSERT INTO work_center_metrics 
       (tenant_id, work_center, metric_date, throughput, avg_cycle_time, queue_depth, utilization, scrap_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, work_center, metric_date) DO UPDATE SET
         throughput = $4, avg_cycle_time = $5, queue_depth = $6, utilization = $7, scrap_rate = $8
       RETURNING id, work_center, metric_date`,
      [tenantId, workCenter, metricDate, throughput || null, avg_cycle_time || null, queue_depth || null, utilization || null, scrap_rate || null]
    )
    
    res.json({ ok: true, metric: result.rows[0] })
  } catch (err) {
    console.error('Error recording metrics:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Get anomaly alerts for a work center
app.get('/api/work-centers/:workCenter/anomalies', async (req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const { workCenter } = req.params
    const lookbackDays = parseInt(req.query.lookbackDays || '30', 10)
    
    // Get recent metrics for this work center
    const metricsRes = await query(
      `SELECT metric_date, throughput, avg_cycle_time, queue_depth, utilization, scrap_rate
       FROM work_center_metrics
       WHERE tenant_id = $1 AND work_center = $2 
       AND metric_date > now() - interval '1 day' * $3
       ORDER BY metric_date DESC
       LIMIT 100`,
      [tenantId, workCenter, lookbackDays]
    )
    
    // For now, return a generic anomaly alert if queue is high
    const alerts = metricsRes.rowCount > 0 ? [{
      type: 'queue_buildup',
      work_center: workCenter,
      severity: 'medium',
      message: `Work center has ${metricsRes.rows[0].queue_depth || 0} jobs queued`,
      metric_value: metricsRes.rows[0].queue_depth || 0,
      historical_baseline: 3,
      deviation_percent: 50
    }] : []
    
    res.json({ ok: true, alerts })
  } catch (err) {
    console.error('Error fetching anomalies:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Get anomalies for all work centers (dashboard view)
app.get('/api/anomalies/dashboard', async (req, res) => {
  try {
    const { tenantId } = await ensureDemoTenantAndToken()
    const lookbackDays = parseInt(req.query.lookbackDays || '30', 10)
    
    // Get all work centers
    const wcResult = await query(
      `SELECT DISTINCT work_center FROM jobs WHERE tenant_id = $1 AND work_center IS NOT NULL`,
      [tenantId]
    )
    
    const alertsByWorkCenter = {}
    
    // Get anomalies for each work center
    for (const row of wcResult.rows) {
      const wc = row.work_center
      const alerts = await getWorkCenterAnomalies(tenantId, wc, lookbackDays)
      if (alerts.length > 0) {
        alertsByWorkCenter[wc] = alerts
      }
    }
    
    res.json({ ok: true, anomalies: alertsByWorkCenter })
  } catch (err) {
    console.error('Error fetching anomalies dashboard:', err)
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
    const { tenantId, rawToken } = await ensureDemoTenantAndToken()
    
    // Start snapshot recording service (every 15 minutes)
    startSnapshotService(tenantId, 15)
    
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
