import oracledb from 'oracledb'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import fetch from 'node-fetch'

// Load env
dotenv.config({ path: new URL('./.env', import.meta.url).pathname })

const {
  ORACLE_USER,
  ORACLE_PASSWORD,
  ORACLE_HOST,
  ORACLE_PORT = 1521,
  ORACLE_SID,
  SHADOWOPS_API_BASE = 'http://localhost:5050',
  TENANT_TOKEN
} = process.env

if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_HOST || !ORACLE_SID) {
  console.error('Missing Oracle connection env vars. Check .env file.')
  process.exit(2)
}
if (!TENANT_TOKEN) {
  console.error('Missing TENANT_TOKEN for ShadowOps API.')
  process.exit(2)
}

const connectString = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${ORACLE_HOST})(PORT=${ORACLE_PORT}))(CONNECT_DATA=(SID=${ORACLE_SID})))`

async function main() {
  let connection
  try {
    // Load SQL
    const sql = await fs.readFile(new URL('./sql/jobs.sql', import.meta.url), 'utf8')
    // Connect to Oracle
    connection = await oracledb.getConnection({
      user: ORACLE_USER,
      password: ORACLE_PASSWORD,
      connectString
    })
    const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
    const jobs = (result.rows || []).map(row => ({
      job_id: row.JOB_ID,
      job: row.JOB,
      work_center: row.WORK_CENTER,
      start_date: row.START_DATE,
      due_date: row.DUE_DATE,
      qty_released: row.QTY_RELEASED,
      qty_completed: row.QTY_COMPLETED,
      hours_to_go: row.HOURS_TO_GO,
      parts_to_go: row.PARTS_TO_GO,
      prod_start_time: row.PROD_START_TIME,
      prod_end_time: row.PROD_END_TIME,
      eplant_id: row.EPLANT_ID,
      eplant_company: row.EPLANT_COMPANY,
      origin: row.ORIGIN,
      firm: row.FIRM,
      part: row.PART,
      part_descrip: row.PART_DESCRIP
    }))
    console.log(`Fetched ${jobs.length} jobs from Oracle.`)
    // POST to ShadowOps API
    const resp = await fetch(`${SHADOWOPS_API_BASE}/api/ingest/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-token': TENANT_TOKEN
      },
      body: JSON.stringify({ jobs })
    })
    const body = await resp.text()
    let json
    try { json = JSON.parse(body) } catch { json = null }
    if (!resp.ok) {
      console.error('Ingest failed:', resp.status, body)
      process.exit(3)
    }
    console.log('Ingest result:', json)
    if (json && json.ok) {
      console.log(`Inserted: ${json.inserted}, Updated: ${json.updated}, Total: ${json.total}`)
    }
  } catch (err) {
    console.error('Sync error:', err)
    process.exit(1)
  } finally {
    if (connection) {
      try { await connection.close() } catch {}
    }
  }
}

if (process.argv.includes('--watch')) {
  // Run every 5 minutes
  (async function loop() {
    while (true) {
      await main()
      console.log('Sleeping 300s...')
      await new Promise(r => setTimeout(r, 300000))
    }
  })()
} else {
  main()
}
