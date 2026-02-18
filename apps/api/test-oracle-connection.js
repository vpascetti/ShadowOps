import oracledb from 'oracledb'
import dotenv from 'dotenv'

dotenv.config()

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function testConnection() {
  console.log('🔌 Testing Oracle connection...')
  console.log('Host:', process.env.IQMS_HOST)
  console.log('Port:', process.env.IQMS_PORT)
  console.log('Service:', process.env.IQMS_SERVICE)
  console.log('User:', process.env.IQMS_USER)
  
  const connectString = `${process.env.IQMS_HOST}:${process.env.IQMS_PORT}/${process.env.IQMS_SERVICE}`
  console.log('Connect string:', connectString)
  
  let connection
  try {
    console.log('\n⏳ Attempting connection (15s timeout)...')
    connection = await oracledb.getConnection({
      user: process.env.IQMS_USER,
      password: process.env.IQMS_PASSWORD,
      connectString,
      connectTimeout: 15 // 15 second timeout
    })
    
    console.log('✅ Connected successfully!')
    
    console.log('\n🧪 Testing simple query...')
    const result = await connection.execute('SELECT 1 FROM DUAL')
    console.log('✅ Query executed:', result.rows)
    
    console.log('\n🧪 Testing IQMS schema access...')
    const tableResult = await connection.execute(
      'SELECT COUNT(*) as cnt FROM USER_TABLES WHERE OWNER = :owner',
      { owner: 'IQMS' }
    )
    console.log('✅ IQMS schema accessible, tables found:', tableResult.rows)
    
  } catch (err) {
    console.error('❌ Error:', err.message)
    if (err.code) console.error('Error code:', err.code)
    if (err.offset) console.error('Error offset:', err.offset)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.close()
      console.log('\n✅ Connection closed')
    }
  }
}

testConnection()
