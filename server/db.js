import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'shadowops',
  password: process.env.PGPASSWORD || 'shadowops_pass',
  database: process.env.PGDATABASE || 'shadowops_db',
})

async function initDB() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        job TEXT UNIQUE NOT NULL,
        part TEXT,
        customer TEXT,
        work_center TEXT,
        start_date DATE,
        due_date DATE,
        qty_released NUMERIC,
        qty_completed NUMERIC,
        source_file TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `)
    // trigger to update updated_at on row change
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_trigger'
        ) THEN
          CREATE TRIGGER set_timestamp_trigger
          BEFORE UPDATE ON jobs
          FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END$$;
    `)
  } finally {
    client.release()
  }
}

export async function query(text, params) {
  const res = await pool.query(text, params)
  return res
}

export { pool, initDB }
