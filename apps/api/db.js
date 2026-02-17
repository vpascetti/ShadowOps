import pg from 'pg'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

const { Pool } = pg

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'shadowops',
  password: process.env.PGPASSWORD || 'shadowops_pass',
  database: process.env.PGDATABASE || 'shadowops_db',
})
// ...existing code...

async function initDB() {
  const client = await pool.connect()
  try {
    // Tenants
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);

    // Tenant tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_tokens (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        token_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        revoked_at TIMESTAMP NULL
      );
    `);

    // Canonical jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        job_id INTEGER NOT NULL,
        job TEXT NOT NULL,
        work_center TEXT,
        customer TEXT,
          part TEXT,
        start_date TIMESTAMP,
        due_date TIMESTAMP,
        qty_released NUMERIC,
        qty_completed NUMERIC,
        hours_to_go NUMERIC,
        parts_to_go NUMERIC,
        prod_start_time TIMESTAMP,
        prod_end_time TIMESTAMP,
        eplant_id INTEGER,
        eplant_company TEXT,
        origin TEXT,
        firm TEXT,
        reason TEXT,
        root_cause TEXT,
        accountable TEXT,
        projected TEXT,
        timeline TEXT,
        status TEXT,
        ingested_at TIMESTAMP DEFAULT now(),
        UNIQUE (tenant_id, job_id)
      );
    `);

    // Add customer column if it doesn't exist (for existing databases)
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer TEXT;
    `);
    
    // Add part column if it doesn't exist (for existing databases)
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS part TEXT;
    `);

    // Optional descriptive columns
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reason TEXT;
    `);
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS root_cause TEXT;
    `);
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS accountable TEXT;
    `);
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS projected TEXT;
    `);
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS timeline TEXT;
    `);
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT;
    `);

    // Inventory table for tracking parts and thresholds (unchanged)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        part TEXT,
        location TEXT,
        qty_on_hand NUMERIC DEFAULT 0,
        min_threshold NUMERIC DEFAULT 0,
        max_threshold NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );
    `);

    // Triggers for updated_at (unchanged)
    await client.query(`
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_trigger_inventory'
        ) THEN
          CREATE TRIGGER set_timestamp_trigger_inventory
          BEFORE UPDATE ON inventory
          FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
      END$$;
    `);
  } finally {
    client.release()
  }
}

export async function query(text, params) {
  const res = await pool.query(text, params)
  return res
}

// Hash a token with salt
export function hashToken(token) {
  const salt = process.env.TOKEN_SALT || 'changeme-dev-salt'
  return crypto.createHash('sha256').update(token + salt).digest('hex')
}

// Find tenant by token hash
export async function getTenantIdByToken(token) {
  const tokenHash = hashToken(token)
  const res = await query(
    `SELECT t.id as tenant_id FROM tenants t
     JOIN tenant_tokens tok ON tok.tenant_id = t.id
     WHERE tok.token_hash = $1 AND tok.revoked_at IS NULL
     LIMIT 1`,
    [tokenHash]
  )
  return res.rowCount > 0 ? res.rows[0].tenant_id : null
}

// Find or create demo tenant and token
export async function ensureDemoTenantAndToken() {
  // Check for tenant
  let res = await query(`SELECT id FROM tenants WHERE name = $1 LIMIT 1`, ['Local Demo Tenant'])
  let tenantId
  if (res.rowCount === 0) {
    res = await query(`INSERT INTO tenants (name) VALUES ($1) RETURNING id`, ['Local Demo Tenant'])
    tenantId = res.rows[0].id
  } else {
    tenantId = res.rows[0].id
  }
  // Check for active token
  res = await query(`SELECT token_hash FROM tenant_tokens WHERE tenant_id = $1 AND revoked_at IS NULL LIMIT 1`, [tenantId])
  if (res.rowCount === 0) {
    // Generate a random token
    const rawToken = crypto.randomBytes(24).toString('hex')
    const tokenHash = hashToken(rawToken)
    await query(`INSERT INTO tenant_tokens (tenant_id, token_hash) VALUES ($1, $2)`, [tenantId, tokenHash])
    return { tenantId, rawToken }
  }
  return { tenantId, rawToken: null }
}

// Upsert job for tenant
export async function upsertJob(tenantId, job) {
  // Only allow required fields and known columns
  const cols = [
    'tenant_id','job_id','job','work_center','customer','part','start_date','due_date','qty_released','qty_completed','hours_to_go','parts_to_go','prod_start_time','prod_end_time','eplant_id','eplant_company','origin','firm','reason','root_cause','accountable','projected','timeline','status','ingested_at'
  ]
  const keys = Object.keys(job).filter(k => cols.includes(k))
  const vals = keys.map(k => job[k])
  const setCols = keys.map((k, i) => `${k} = $${i+2}`)
  // Upsert by (tenant_id, job_id)
  const sql = `INSERT INTO jobs (tenant_id, ${keys.join(',')}) VALUES ($1,${keys.map((_,i)=>`$${i+2}`).join(',')})
    ON CONFLICT (tenant_id, job_id) DO UPDATE SET ${setCols.join(', ')}, ingested_at = now()`
  await query(sql, [tenantId, ...vals])
}

export { pool, initDB }
