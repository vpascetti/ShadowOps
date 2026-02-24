import {
  calculateRiskScore,
  type DataProvider,
  type Job,
  type JobDetail,
  type JobQuery,
  type MetricsSummary
} from '@shadowops/core'
import { ensureDemoTenantAndToken, query } from '../../db.js'

const HOURS_PER_DAY = 8
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toDateString = (value: Date | string | null) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

const computeRemainingWork = (row: Record<string, unknown>) => {
  const hoursToGo = Number(row.hours_to_go)
  if (Number.isFinite(hoursToGo)) return Math.max(0, hoursToGo)

  const qtyReleased = Number(row.qty_released)
  const qtyCompleted = Number(row.qty_completed)
  if (Number.isFinite(qtyReleased) && Number.isFinite(qtyCompleted)) {
    return Math.max(0, qtyReleased - qtyCompleted)
  }

  return 0
}

const computeAvailableCapacity = (dueDate: Date, asOf: Date) => {
  const daysUntilDue = Math.floor((dueDate.getTime() - asOf.getTime()) / MS_PER_DAY)
  if (!Number.isFinite(daysUntilDue) || daysUntilDue <= 0) return 0
  return daysUntilDue * HOURS_PER_DAY
}

const computeRiskReason = (dueDate: Date, remainingWork: number, availableCapacity: number) => {
  const asOf = new Date()
  const daysUntilDue = Math.floor((dueDate.getTime() - asOf.getTime()) / MS_PER_DAY)
  if (!Number.isFinite(daysUntilDue)) return 'on_track'
  if (daysUntilDue <= 0) return 'past_due'
  if (availableCapacity > 0 && remainingWork / availableCapacity > 1) return 'capacity_overload'
  if (daysUntilDue <= 7) return 'due_soon'
  return 'on_track'
}

const toJob = (row: Record<string, unknown>): Job | null => {
  const dueDate = row.due_date ? new Date(String(row.due_date)) : null
  if (!dueDate || Number.isNaN(dueDate.getTime())) return null

  const asOf = new Date()
  const remainingWork = computeRemainingWork(row)
  const status = String(row.status || 'open')
  const jobId = String(row.job_id ?? row.job ?? '')
  if (!jobId) return null

  const plantId = row.eplant_id ? String(row.eplant_id) : ''
  const plantName = row.eplant_company ? String(row.eplant_company) : ''
  const plantLabel = plantName || (plantId ? `Plant ${plantId}` : '')

  const baseJob: Job = {
    job_id: jobId,
    due_date: toDateString(dueDate) || '',
    status,
    remaining_work: remainingWork,
    risk_score: 0,
    risk_reason: 'on_track'
  }

  const availableCapacity = computeAvailableCapacity(dueDate, asOf)
  const riskScore = calculateRiskScore(baseJob, { availableCapacity })
  const riskReason = computeRiskReason(dueDate, remainingWork, availableCapacity)

  return {
    ...baseJob,
    risk_score: riskScore,
    risk_reason: riskReason,
    ...(plantId && { plant_id: plantId, eplant_id: plantId }),
    ...(plantName && { eplant_company: plantName, plant_name: plantName }),
    ...(plantLabel && { Plant: plantLabel })
  }
}

export class DbProvider implements DataProvider {
  async getJobs(queryParams?: JobQuery): Promise<Job[]> {
    const { tenantId } = await ensureDemoTenantAndToken()
    const where: string[] = ['tenant_id = $1']
    const values: Array<string | number> = [tenantId]

    if (queryParams?.status) {
      values.push(queryParams.status)
      if (queryParams.status === 'open') {
        where.push(`(status = $${values.length} OR status IS NULL)`)
      } else {
        where.push(`status = $${values.length}`)
      }
    }
    if (queryParams?.dueDateStart) {
      values.push(queryParams.dueDateStart)
      where.push(`due_date >= $${values.length}`)
    }
    if (queryParams?.dueDateEnd) {
      values.push(queryParams.dueDateEnd)
      where.push(`due_date <= $${values.length}`)
    }
    if (queryParams?.resourceId) {
      values.push(queryParams.resourceId)
      where.push(`work_center = $${values.length}`)
    }

    const sql = `
      SELECT job_id, job, due_date, status, qty_released, qty_completed, hours_to_go, work_center, eplant_id, eplant_company
      FROM jobs
      WHERE ${where.join(' AND ')}
      ORDER BY due_date ASC NULLS LAST
    `

    const result = await query(sql, values)
    const jobs = result.rows
      .map((row) => toJob(row))
      .filter((job): job is Job => Boolean(job))

    return jobs.sort((a, b) => b.risk_score - a.risk_score)
  }

  async getJobById(jobId: string): Promise<JobDetail | null> {
    const { tenantId } = await ensureDemoTenantAndToken()
    const sql = `
      SELECT job_id, job, due_date, status, qty_released, qty_completed, hours_to_go, work_center, eplant_id, eplant_company
      FROM jobs
      WHERE tenant_id = $1 AND (job_id::text = $2 OR job = $2)
      LIMIT 1
    `
    const result = await query(sql, [tenantId, jobId])
    if (result.rowCount === 0) return null

    const row = result.rows[0]
    const job = toJob(row)
    if (!job) return null

    const dueDate = new Date(job.due_date)
    const availableCapacity = computeAvailableCapacity(dueDate, new Date())
    const workCenter = String(row.work_center || 'UNASSIGNED')
    const remainingTime = Number(row.hours_to_go)
    const operationRemaining = Number.isFinite(remainingTime) ? remainingTime : job.remaining_work

    return {
      job,
      operations: [
        {
          operation_id: `${job.job_id}-OP1`,
          job_id: job.job_id,
          resource_id: workCenter,
          sequence: 10,
          standard_rate: 1,
          actual_rate: 1,
          remaining_time: operationRemaining
        }
      ],
      materials: [],
      resources: [
        {
          resource_id: workCenter,
          resource_type: 'work_center',
          available_capacity: availableCapacity,
          scheduled_load: job.remaining_work
        }
      ]
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
