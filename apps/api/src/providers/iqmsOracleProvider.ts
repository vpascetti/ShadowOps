import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import {
  calculateRiskScore,
  type DataProvider,
  type Job,
  type JobDetail,
  type JobQuery,
  type MetricsSummary,
  type Operation,
  type Resource,
  type MaterialRequirement
} from '@shadowops/core'

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const MS_PER_DAY = 24 * 60 * 60 * 1000

const env = (key: string) => process.env[key] || ''

const buildConnectString = () => {
  const direct = env('IQMS_CONNECT_STRING')
  if (direct) return direct

  const tnsAlias = env('IQMS_TNS_ALIAS')
  if (tnsAlias) return tnsAlias

  const host = env('IQMS_HOST')
  const service = env('IQMS_SERVICE')
  const port = env('IQMS_PORT') || '1521'
  if (host && service) return `${host}:${port}/${service}`

  return ''
}

const readSqlFile = (filePath: string) => {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath)
  return fs.readFileSync(resolved, 'utf8')
}

const getSql = (key: string) => {
  const fileKey = `${key}_FILE`
  const filePath = env(fileKey)
  if (filePath) {
    return readSqlFile(filePath)
  }
  return env(key)
}

const getRequiredSql = (key: string) => {
  const sql = getSql(key)
  if (!sql) {
    throw new Error(`Missing ${key} for IQMS provider`)
  }
  return sql
}

const normalizeKey = (key: string) => key.toLowerCase()

const getRowValue = (row: Record<string, unknown>, keys: string[]) => {
  const map = new Map(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]))
  for (const key of keys) {
    const value = map.get(normalizeKey(key))
    if (value !== undefined) return value
  }
  return undefined
}

const toIsoDate = (value: unknown) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const buildJobFromRow = (row: Record<string, unknown>): Job | null => {
  const jobId = String(getRowValue(row, ['job_id', 'job', 'workorder', 'work_order']) || '')
  const dueDateRaw = getRowValue(row, ['due_date', 'due', 'promise_date', 'must_end_date'])
  const dueDate = toIsoDate(dueDateRaw)
  if (!jobId || !dueDate) return null

  const remainingWork = toNumber(getRowValue(row, ['remaining_work', 'hours_to_go', 'hrs_to_go']), 0)
  const status = String(getRowValue(row, ['status', 'job_status']) || 'open')
  const availableCapacity = toNumber(getRowValue(row, ['available_capacity', 'available_hours']), 0)

  const baseJob: Job = {
    job_id: jobId,
    due_date: dueDate,
    status,
    remaining_work: remainingWork,
    risk_score: 0
  }

  const riskScore = calculateRiskScore(baseJob, { availableCapacity })

  return {
    ...baseJob,
    risk_score: riskScore
  }
}

const applyJobFilters = (jobs: Job[], query?: JobQuery) => {
  if (!query) return jobs
  return jobs.filter((job) => {
    if (query.status && job.status !== query.status) return false
    if (query.dueDateStart) {
      if (new Date(job.due_date) < new Date(query.dueDateStart)) return false
    }
    if (query.dueDateEnd) {
      if (new Date(job.due_date) > new Date(query.dueDateEnd)) return false
    }
    return true
  })
}

const formatOperation = (row: Record<string, unknown>): Operation => {
  return {
    operation_id: String(getRowValue(row, ['operation_id', 'op_id', 'operation']) || ''),
    job_id: String(getRowValue(row, ['job_id', 'job', 'workorder', 'work_order']) || ''),
    resource_id: String(getRowValue(row, ['resource_id', 'work_center', 'workcenter']) || ''),
    sequence: toNumber(getRowValue(row, ['sequence', 'operation_seq', 'op_seq']), 0),
    standard_rate: toNumber(getRowValue(row, ['standard_rate', 'std_rate']), 0),
    actual_rate: toNumber(getRowValue(row, ['actual_rate', 'act_rate']), 0),
    remaining_time: toNumber(getRowValue(row, ['remaining_time', 'hours_to_go', 'hrs_to_go']), 0)
  }
}

const formatResource = (row: Record<string, unknown>): Resource => {
  return {
    resource_id: String(getRowValue(row, ['resource_id', 'work_center', 'workcenter']) || ''),
    resource_type: String(getRowValue(row, ['resource_type']) || 'work_center'),
    available_capacity: toNumber(getRowValue(row, ['available_capacity', 'available_hours']), 0),
    scheduled_load: toNumber(getRowValue(row, ['scheduled_load', 'load']), 0)
  }
}

const formatMaterial = (row: Record<string, unknown>): MaterialRequirement => {
  const requiredQty = toNumber(getRowValue(row, ['required_qty', 'qty_required']), 0)
  const issuedQty = toNumber(getRowValue(row, ['issued_qty', 'qty_issued']), 0)

  return {
    job_id: String(getRowValue(row, ['job_id', 'job', 'workorder', 'work_order']) || ''),
    item_id: String(getRowValue(row, ['item_id', 'part', 'item']) || ''),
    required_qty: requiredQty,
    issued_qty: issuedQty,
    availability_flag: issuedQty >= requiredQty
  }
}

let poolPromise: Promise<oracledb.Pool> | null = null

const getPool = async () => {
  if (!poolPromise) {
    const connectString = buildConnectString()
    if (!connectString) {
      throw new Error('IQMS connection string is not configured')
    }

    poolPromise = oracledb.createPool({
      user: env('IQMS_USER'),
      password: env('IQMS_PASSWORD'),
      connectString
    })
  }
  return poolPromise
}

const execute = async (sql: string, binds: Record<string, unknown> = {}) => {
  const pool = await getPool()
  const connection = await pool.getConnection()
  try {
    const result = await connection.execute(sql, binds)
    return (result.rows || []) as Record<string, unknown>[]
  } finally {
    await connection.close()
  }
}

export class IQMSOracleProvider implements DataProvider {
  async getJobs(query?: JobQuery): Promise<Job[]> {
    const sql = getRequiredSql('IQMS_SQL_JOBS')
    const rows = await execute(sql)
    const jobs = rows.map(buildJobFromRow).filter((job): job is Job => Boolean(job))
    return applyJobFilters(jobs, query).sort((a, b) => b.risk_score - a.risk_score)
  }

  async getJobById(jobId: string): Promise<JobDetail | null> {
    const detailSql = getSql('IQMS_SQL_JOB_DETAIL')
    let rows: Record<string, unknown>[] = []

    if (detailSql) {
      rows = await execute(detailSql, { jobId })
    } else {
      const jobs = await this.getJobs()
      const match = jobs.find((job) => job.job_id === jobId)
      if (!match) return null
      return { job: match, operations: [], materials: [], resources: [] }
    }

    const job = rows[0] ? buildJobFromRow(rows[0]) : null
    if (!job) return null

    const operationsSql = getSql('IQMS_SQL_OPERATIONS')
    const resourcesSql = getSql('IQMS_SQL_RESOURCES')
    const materialsSql = getSql('IQMS_SQL_MATERIALS')

    const [operations, resources, materials] = await Promise.all([
      operationsSql ? execute(operationsSql, { jobId }) : Promise.resolve([]),
      resourcesSql ? execute(resourcesSql, { jobId }) : Promise.resolve([]),
      materialsSql ? execute(materialsSql, { jobId }) : Promise.resolve([])
    ])

    return {
      job,
      operations: operations.map(formatOperation),
      resources: resources.map(formatResource),
      materials: materials.map(formatMaterial)
    }
  }

  async getMetricsSummary(): Promise<MetricsSummary> {
    const jobs = await this.getJobs()
    const asOf = new Date()

    const atRiskCount = jobs.filter((job) => job.risk_score >= 70).length
    const dueNext7Days = jobs.filter((job) => {
      const due = new Date(job.due_date)
      const diff = (due.getTime() - asOf.getTime()) / MS_PER_DAY
      return diff >= 0 && diff <= 7
    }).length

    return {
      atRiskCount,
      dueNext7Days,
      overloadedResourcesCount: 0
    }
  }
}
