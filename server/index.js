import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Papa from 'papaparse'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { initDB, query, pool } from './db.js'

dotenv.config()

const app = express()
const port = parseInt(process.env.PORT || '5050', 10)

app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// CSV upload endpoint
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No file uploaded' })
  }

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

      // Check if exists
      const existRes = await client.query('SELECT id FROM jobs WHERE job = $1', [job])
      if (existRes.rowCount > 0) {
        await client.query(
          `UPDATE jobs SET part=$1, customer=$2, work_center=$3, start_date=$4, due_date=$5, qty_released=$6, qty_completed=$7, source_file=$8 WHERE job=$9`,
          [part, customer, work_center, start_date || null, due_date || null, qtyReleasedNum, qtyCompletedNum, req.file.originalname, job]
        )
        updated += 1
      } else {
        await client.query(
          `INSERT INTO jobs (job, part, customer, work_center, start_date, due_date, qty_released, qty_completed, source_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [job, part, customer, work_center, start_date || null, due_date || null, qtyReleasedNum, qtyCompletedNum, req.file.originalname]
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

// Fetch jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const sql = `SELECT job, part, customer, work_center, to_char(start_date,'YYYY-MM-DD') as start_date, to_char(due_date,'YYYY-MM-DD') as due_date, qty_released, qty_completed, source_file, to_char(created_at,'YYYY-MM-DD HH24:MI:SS') as created_at, to_char(updated_at,'YYYY-MM-DD HH24:MI:SS') as updated_at FROM jobs ORDER BY due_date ASC NULLS LAST`;
    const result = await query(sql)
    res.json({ ok: true, jobs: result.rows })
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
initDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`ShadowOps backend listening on port ${port}`)
    })
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err)
    process.exit(1)
  })
