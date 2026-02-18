import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config()

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function exploreWorkCenter() {
  const connection = await oracledb.getConnection({
    user: process.env.IQMS_USER,
    password: process.env.IQMS_PASSWORD,
    connectString: process.env.IQMS_CONNECT_STRING
  })

  try {
    console.log('📋 WORK_CENTER columns:\n')
    const cols = await connection.execute(`
      SELECT column_name, data_type
      FROM all_tab_columns
      WHERE owner = 'IQMS' AND table_name = 'WORK_CENTER'
      ORDER BY column_id
    `)
    
    cols.rows.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE})`)
    })
    
    console.log('\n📊 Sample WORK_CENTER record:\n')
    const sample = await connection.execute(`
      SELECT * FROM IQMS.WORK_CENTER WHERE ROWNUM = 1
    `)
    
    if (sample.rows.length > 0) {
      Object.entries(sample.rows[0]).forEach(([key, value]) => {
        if (value !== null) console.log(`  ${key}: ${value}`)
      })
    }

  } finally {
    await connection.close()
  }
}

exploreWorkCenter().catch(console.error)
