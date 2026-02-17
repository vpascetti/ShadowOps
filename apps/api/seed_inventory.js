import { query, initDB, pool } from './db.js'

async function seed() {
  await initDB()
  const samples = [
    { sku: 'SKU-100', part: 'Widget A', location: 'WH-A', qty: 50, min: 10, max: 200 },
    { sku: 'SKU-200', part: 'Widget B', location: 'WH-B', qty: 2, min: 5, max: 50 },
    { sku: 'SKU-300', part: 'Widget C', location: 'WH-C', qty: 500, min: 20, max: 400 },
  ]

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const s of samples) {
      await client.query(
        `INSERT INTO inventory (sku, part, location, qty_on_hand, min_threshold, max_threshold)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (sku) DO UPDATE SET part=EXCLUDED.part, location=EXCLUDED.location, qty_on_hand=EXCLUDED.qty_on_hand, min_threshold=EXCLUDED.min_threshold, max_threshold=EXCLUDED.max_threshold`,
        [s.sku, s.part, s.location, s.qty, s.min, s.max]
      )
    }
    await client.query('COMMIT')
    console.log('Seed complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed', err)
    process.exit(1)
  } finally {
    client.release()
    process.exit(0)
  }
}

seed()
