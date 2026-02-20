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

export type RealtimePartNumber = {
  work_center: string
  work_center_desc?: string
  item_no?: string
  description?: string
  mfg_no?: string
  parts_to_go?: number
  hours_left?: number
  std_cycle?: number
  last_cycle?: number
  avg_cycle?: number
  act_cav?: number
  std_cav?: number
  shift_up?: number
  shift_dwn?: number
  down_code?: string
  down_descrip?: string
  down_start_time?: string
  workorder_id?: string
  cust_no?: string
  priority_level?: number
  has_qc_issues?: boolean
  qc_issue_count?: number
  run_qty?: number
  op_desc?: string
  op_no?: string
  start_time?: string
  // PM Schedule fields from PMJOB integration
  next_pm_due_date?: string | null
  days_until_next_pm?: number | null
  pm_status?: string | null
}

export type JobMaterialDetail = {
  class?: string
  item_no: string
  rev?: string
  description?: string
  description2?: string
  plant_id?: string
  prod_date?: string
  arinvt_id?: number
  division_id?: number
  qty_required: number
  onhand: number
  shortage_qty: number
  standard_plant_id?: string
}

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
  const jobId = String(getRowValue(row, ['job_id', 'workorder_id']) || '')
  const dueDateRaw = getRowValue(row, ['due_date', 'promise_date'])
  const dueDate = toIsoDate(dueDateRaw)
  if (!jobId || !dueDate) return null

  // Extract all fields from row
  const remainingWork = toNumber(getRowValue(row, ['remaining_work', 'hours_to_go']), 0)
  const status = String(getRowValue(row, ['status']) || 'open')
  const firm = String(getRowValue(row, ['firm']) || 'N')
  const part = String(getRowValue(row, ['part', 'itemno']) || '')
  const description = String(getRowValue(row, ['description', 'descrip']) || '')
  const customer = String(getRowValue(row, ['customer', 'custno']) || '')
  const workCenter = String(getRowValue(row, ['work_center', 'eqno']) || '')
  const plantId = String(getRowValue(row, ['plant_id', 'eplant_id']) || '')
  const plantName = String(getRowValue(row, ['eplant_company', 'plant_name', 'eplant_name']) || '')
  const plantLabel = plantName || (plantId ? `Plant ${plantId}` : '')
  const priority = String(getRowValue(row, ['priority']) || '')
  const priorityLevel = toNumber(getRowValue(row, ['priority_level']), 0)
  const priorityNote = String(getRowValue(row, ['priority_note']) || '')
  
  // Material risk indicators
  const materialException = String(getRowValue(row, ['material_exception', 'is_xcpt_mat']) || 'N')
  const hardAllocated = String(getRowValue(row, ['hard_allocated', 'is_hard_allocated']) || 'N')
  const fgAllocate = toNumber(getRowValue(row, ['fg_allocate']), 0)
  const poAllocate = toNumber(getRowValue(row, ['po_allocate']), 0)
  const schedAllocate = toNumber(getRowValue(row, ['sched_allocate']), 0)

  // Material shortage item detail (largest material requirement per job)
  const materialItem = String(getRowValue(row, ['material_item', 'material_descrip']) || '')
  const materialRequiredQty = toNumber(getRowValue(row, ['material_required_qty']), 0)
  const materialIssuedQty = toNumber(getRowValue(row, ['material_issued_qty']), 0)
  const materialShortQty = toNumber(getRowValue(row, ['material_short_qty']), 0)
  const hasMaterialShortage = materialException === 'Y' || materialShortQty > 0
  
  // Timing data  
  const prodStartTime = getRowValue(row, ['prod_start_time'])
  const prodEndTime = getRowValue(row, ['prod_end_time'])
  const mustShipDate = getRowValue(row, ['must_ship_date'])
  
  // Quantities
  const partsToGo = toNumber(getRowValue(row, ['parts_to_go']), 0)
  const mfgQuantity = toNumber(getRowValue(row, ['mfg_quantity', 'mfg_quan']), 0)
  
  // Pricing data from ORD_DETAIL
  const unitPrice = toNumber(getRowValue(row, ['unit_price']), null)
  const totalOrderValue = toNumber(getRowValue(row, ['total_order_value']), null)
  
  // Work Center Capacity Data
  const workCenterLoad = toNumber(getRowValue(row, ['work_center_load', 'total_load']), 0)
  const workCenterQueueDepth = toNumber(getRowValue(row, ['work_center_queue_depth', 'queue_depth']), 0)
  
  // Calculate risk scores for each factor
  const now = new Date()
  const due = new Date(dueDate)
  const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  const hoursPerDay = 24
  const daysRemainingWork = remainingWork / hoursPerDay
  
  // 1. LATE DELIVERY RISK (40% weight)
  let lateDeliveryRisk = 0
  if (daysUntilDue < 0) {
    lateDeliveryRisk = 100 // Already late
  } else if (daysUntilDue < daysRemainingWork) {
    // Not enough time to complete
    const shortfall = daysRemainingWork - daysUntilDue
    lateDeliveryRisk = Math.min(100, 50 + (shortfall * 10))
  } else if (daysUntilDue < 7) {
    // Due within 7 days
    lateDeliveryRisk = Math.max(30, 70 - (daysUntilDue * 5))
  } else if (daysUntilDue < 14) {
    lateDeliveryRisk = 20
  }
  
  // Boost risk if firm and priority
  if (firm === 'Y') lateDeliveryRisk = Math.min(100, lateDeliveryRisk * 1.2)
  if (priorityLevel > 0) lateDeliveryRisk = Math.min(100, lateDeliveryRisk * 1.1)
  
  // 2. MATERIAL SHORTAGE RISK (35% weight)
  let materialShortageRisk = 0
  if (materialException === 'Y') {
    materialShortageRisk = 80
  } else if (hardAllocated === 'N') {
    // Not hard allocated - potential shortage
    const totalAllocated = fgAllocate + poAllocate + schedAllocate
    if (totalAllocated < mfgQuantity * 0.5) {
      materialShortageRisk = 70
    } else if (totalAllocated < mfgQuantity * 0.8) {
      materialShortageRisk = 40
    } else if (totalAllocated < mfgQuantity) {
      materialShortageRisk = 20
    }
  }
  
  // 3. CAPACITY OVERLOAD RISK (25% weight)
  // Uses actual work center queue depth and load
  let capacityRisk = 0
  
  // Factor 1: Work center queue depth (how many jobs waiting)
  if (workCenterQueueDepth > 0) {
    if (workCenterQueueDepth >= 10) {
      capacityRisk = 80 // Severely overloaded
    } else if (workCenterQueueDepth >= 5) {
      capacityRisk = 60 // High queue
    } else if (workCenterQueueDepth >= 3) {
      capacityRisk = 40 // Moderate queue
    } else {
      capacityRisk = 20 // Some queue
    }
  }
  
  // Factor 2: Total work center load (weeks of work)
  const weeksOfWork = workCenterLoad / (40 * hoursPerDay) // Assuming 40-hour work week
  if (weeksOfWork > 8) {
    capacityRisk = Math.min(100, capacityRisk + 30) // 8+ weeks backlog
  } else if (weeksOfWork > 4) {
    capacityRisk = Math.min(100, capacityRisk + 20) // 4-8 weeks
  } else if (weeksOfWork > 2) {
    capacityRisk = Math.min(100, capacityRisk + 10) // 2-4 weeks
  }
  
  // Factor 3: This specific job's size contributes to bottleneck
  if (remainingWork > 1000) {
    capacityRisk = Math.min(100, capacityRisk + 15) // Very long job
  } else if (remainingWork > 500) {
    capacityRisk = Math.min(100, capacityRisk + 10)
  }
  
  // Combined risk score
  const riskScore = Math.round(
    (lateDeliveryRisk * 0.4) + 
    (materialShortageRisk * 0.35) + 
    (capacityRisk * 0.25)
  )

  return {
    // Core fields
    Job: jobId,
    DueDate: dueDate,
    status,
    remaining_work: remainingWork,
    risk_score: Math.min(100, riskScore),
    
    // UI-expected fields
    Part: part || '—',
    Customer: customer || '—',
    WorkCenter: workCenter || '—',
    StartDate: toIsoDate(prodStartTime),
    QtyReleased: mfgQuantity || 0,
    QtyCompleted: mfgQuantity > 0 && partsToGo >= 0 ? Math.max(0, mfgQuantity - partsToGo) : 0,

    // Material shortage snapshot for dashboard
    ...(hasMaterialShortage && {
      MaterialShortage: true,
      MaterialItem: materialItem,
      MaterialRequiredQty: materialRequiredQty,
      MaterialIssuedQty: materialIssuedQty,
      MaterialShortQty: materialShortQty
    }),
    
    // Legacy snake_case for backward compatibility
    job_id: jobId,
    due_date: dueDate,
    part,
    customer,
    work_center: workCenter,
    parts_to_go: partsToGo,
    
    // Pricing data
    ...(unitPrice !== null && { unit_price: unitPrice }),
    ...(totalOrderValue !== null && { total_order_value: totalOrderValue }),
    
    // Plant identity
    ...(plantId && { plant_id: plantId, eplant_id: plantId }),
    ...(plantName && { eplant_company: plantName, plant_name: plantName }),
    ...(plantLabel && { Plant: plantLabel }),

    // Additional metadata
    ...(description && { description }),
    ...(priorityNote && { priority_note: priorityNote }),
    ...(firm === 'Y' && { firm: true }),
    ...(materialException === 'Y' && { material_exception: true })
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

const formatRealtimePart = (row: Record<string, unknown>): RealtimePartNumber => {
  return {
    work_center: String(getRowValue(row, ['work_center', 'eqno']) || ''),
    work_center_desc: String(getRowValue(row, ['work_center_desc', 'cntr_desc']) || ''),
    item_no: String(getRowValue(row, ['item_no', 'itemno']) || ''),
    description: String(getRowValue(row, ['description', 'descrip']) || ''),
    mfg_no: String(getRowValue(row, ['mfg_no', 'mfgno']) || ''),
    parts_to_go: toNumber(getRowValue(row, ['parts_to_go', 'partstogo']), 0),
    hours_left: toNumber(getRowValue(row, ['hours_left', 'hours_to_go']), 0),
    std_cycle: toNumber(getRowValue(row, ['std_cycle']), 0),
    last_cycle: toNumber(getRowValue(row, ['last_cycle']), 0),
    avg_cycle: toNumber(getRowValue(row, ['avg_cycle']), 0),
    act_cav: toNumber(getRowValue(row, ['act_cav', 'actcav']), 0),
    std_cav: toNumber(getRowValue(row, ['std_cav', 'stdcav']), 0),
    shift_up: toNumber(getRowValue(row, ['shift_up']), 0),
    shift_dwn: toNumber(getRowValue(row, ['shift_dwn']), 0),
    down_code: String(getRowValue(row, ['down_code']) || ''),
    down_descrip: String(getRowValue(row, ['down_descrip']) || ''),
    down_start_time: String(getRowValue(row, ['down_start_time', 'dwn_st_time']) || ''),
    workorder_id: String(getRowValue(row, ['workorder_id', 'workorder']) || ''),
    cust_no: String(getRowValue(row, ['cust_no', 'custno']) || ''),
    priority_level: toNumber(getRowValue(row, ['priority_level']), 0),
    has_qc_issues: String(getRowValue(row, ['has_qc_issues']) || 'N') === 'Y',
    qc_issue_count: toNumber(getRowValue(row, ['qc_issue_count']), 0),
    run_qty: toNumber(getRowValue(row, ['run_qty']), 0),
    op_desc: String(getRowValue(row, ['op_desc', 'opdesc']) || ''),
    op_no: String(getRowValue(row, ['op_no', 'opno']) || ''),
    start_time: String(getRowValue(row, ['start_time']) || '')
  }
}

const formatJobMaterialDetail = (row: Record<string, unknown>): JobMaterialDetail => {
  const itemNo = String(getRowValue(row, ['item_no', 'itemno']) || '')
  const qtyRequired = toNumber(getRowValue(row, ['qty', 'qty_required', 'tot_mat_qty']), 0)
  const onhand = toNumber(getRowValue(row, ['onhand']), 0)
  const shortageQty = toNumber(getRowValue(row, ['shortage_qty']), 0)

  return {
    item_no: itemNo,
    class: String(getRowValue(row, ['class']) || ''),
    rev: String(getRowValue(row, ['rev']) || ''),
    description: String(getRowValue(row, ['description', 'descrip']) || ''),
    description2: String(getRowValue(row, ['description2', 'descrip2']) || ''),
    plant_id: String(getRowValue(row, ['plant_id', 'eplant_id']) || ''),
    prod_date: toIsoDate(getRowValue(row, ['prod_date'])),
    arinvt_id: toNumber(getRowValue(row, ['arinvt_id']), undefined),
    division_id: toNumber(getRowValue(row, ['division_id']), undefined),
    qty_required: qtyRequired,
    onhand,
    shortage_qty: shortageQty,
    standard_plant_id: String(getRowValue(row, ['standard_plant_id', 'standard_eplant_id']) || '')
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

// Simple in-memory cache
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const jobsCache: CacheEntry<Job[]> | null = null
const CACHE_TTL_MS = parseInt(process.env.IQMS_CACHE_TTL_SECONDS || '0', 10) * 1000 // Default: no cache
const USE_CACHE = CACHE_TTL_MS > 0

const isCacheValid = <T,>(cache: CacheEntry<T> | null): cache is CacheEntry<T> => {
  if (!cache) return false
  return Date.now() - cache.timestamp < CACHE_TTL_MS
}

export class IQMSOracleProvider implements DataProvider {
  private jobsCache: CacheEntry<Job[]> | null = null

  async getJobs(query?: JobQuery): Promise<Job[]> {
    // Check cache first (only if enabled)
    if (USE_CACHE && isCacheValid(this.jobsCache)) {
      console.log('[Cache] Serving jobs from cache')
      return applyJobFilters(this.jobsCache.data, query).sort((a, b) => b.risk_score - a.risk_score)
    }

    // Cache miss - query database
    console.log('[DB] Fetching jobs from database...')
    const sql = getRequiredSql('IQMS_SQL_JOBS')
    const rows = await execute(sql)
    const jobs = rows.map(buildJobFromRow).filter((job): job is Job => Boolean(job))
    
    // Update cache if enabled
    if (USE_CACHE) {
      this.jobsCache = { data: jobs, timestamp: Date.now() }
      console.log(`[Cache] Cached ${jobs.length} jobs`)
    }
    
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

  async getRealtimePartNumbers(): Promise<RealtimePartNumber[]> {
    const realtimeSql = getSql('IQMS_SQL_REALTIME_PART_NUMBERS')
    if (!realtimeSql) return []
    const rows = await execute(realtimeSql)
    return rows.map(formatRealtimePart).filter((row) => row.work_center)
  }

  async getJobMaterialsDetail(jobId: string): Promise<JobMaterialDetail[]> {
    const materialDetailSql = getSql('IQMS_SQL_JOB_MATERIALS_DETAIL')
    if (!materialDetailSql) return []
    const rows = await execute(materialDetailSql, { workorder_id: jobId })
    return rows.map(formatJobMaterialDetail).filter((row) => row.item_no)
  }
}
