import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config()

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function exploreSchema() {
  console.log('🔍 Exploring IQMS schema...\n')
  
  const connection = await oracledb.getConnection({
    user: process.env.IQMS_USER,
    password: process.env.IQMS_PASSWORD,
    connectString: process.env.IQMS_CONNECT_STRING
  })

  try {
    // List all tables/views accessible to IQMS user
    console.log('📋 Available Tables and Views:\n')
    const tables = await connection.execute(`
      SELECT table_name, num_rows 
      FROM all_tables 
      WHERE owner = 'IQMS' 
      ORDER BY table_name
    `)
    
    console.log(`Found ${tables.rows.length} tables:`)
    tables.rows.slice(0, 50).forEach(row => {
      console.log(`  - ${row.TABLE_NAME} (${row.NUM_ROWS || '?'} rows)`)
    })
    if (tables.rows.length > 50) console.log(`  ... and ${tables.rows.length - 50} more`)

    // Check for key tables we're using
    console.log('\n\n🔑 Key Tables Column Details:\n')
    
    const keyTables = ['V_SCHED_HRS_TO_GO', 'WORKORDER', 'PTORDER', 'PTALLOCATE', 'WORK_CENTER', 'ARINVT']
    
    for (const tableName of keyTables) {
      try {
        const cols = await connection.execute(`
          SELECT column_name, data_type, nullable
          FROM all_tab_columns
          WHERE owner = 'IQMS' AND table_name = :tableName
          ORDER BY column_id
        `, { tableName })
        
        console.log(`\n${tableName} (${cols.rows.length} columns):`)
        cols.rows.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.NULLABLE === 'N' ? ', NOT NULL' : ''})`)
        })
      } catch (err) {
        console.log(`\n${tableName}: Not accessible`)
      }
    }

    // Sample data from V_SCHED_HRS_TO_GO
    console.log('\n\n📊 Sample Record from V_SCHED_HRS_TO_GO:\n')
    const sample = await connection.execute(`
      SELECT * FROM IQMS.V_SCHED_HRS_TO_GO WHERE ROWNUM = 1
    `)
    if (sample.rows.length > 0) {
      const record = sample.rows[0]
      Object.entries(record).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`)
      })
    }

  } finally {
    await connection.close()
  }
}

exploreSchema().catch(console.error)
