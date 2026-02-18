import oracledb from 'oracledb'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function testCapacityQuery() {
  console.log('🏭 Testing Work Center Capacity Query...\n')
  
  const connection = await oracledb.getConnection({
    user: process.env.IQMS_USER,
    password: process.env.IQMS_PASSWORD,
    connectString: process.env.IQMS_CONNECT_STRING
  })

  try {
    const sql = fs.readFileSync('./sql/iqms_work_center_capacity.sql', 'utf8')
    const result = await connection.execute(sql)
    
    console.log(`✅ Found ${result.rows.length} work centers\n`)
    
    if (result.rows.length > 0) {
      console.log('Top 10 by utilization:')
      result.rows.slice(0, 10).forEach((row, i) => {
        console.log(`${i + 1}. ${row.WORK_CENTER_ID} - ${row.QUEUE_DEPTH} jobs, ${row.CURRENT_LOAD_HOURS?.toFixed(1)}h load, ${row.UTILIZATION_PERCENT}% utilization`)
      })
      
      console.log('\n📊 Summary:')
      const overloaded = result.rows.filter(r => r.UTILIZATION_PERCENT > 100).length
      const nearCapacity = result.rows.filter(r => r.UTILIZATION_PERCENT > 80 && r.UTILIZATION_PERCENT <= 100).length
      const normal = result.rows.filter(r => r.UTILIZATION_PERCENT <= 80).length
      
      console.log(`  🔴 Overloaded (>100%): ${overloaded}`)
      console.log(`  🟡 Near Capacity (80-100%): ${nearCapacity}`)
      console.log(`  🟢 Normal (<80%): ${normal}`)
    }

  } finally {
    await connection.close()
  }
}

testCapacityQuery().catch(console.error)
