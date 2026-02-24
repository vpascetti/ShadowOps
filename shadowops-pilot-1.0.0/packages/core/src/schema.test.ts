import { describe, expect, it } from 'vitest'
import { JobSchema, MaterialRequirementSchema, OperationSchema, ResourceSchema } from './schema.js'

describe('canonical schemas', () => {
  it('validates a job', () => {
    const result = JobSchema.safeParse({
      job_id: 'JOB-1',
      due_date: '2026-02-10',
      priority: 1,
      status: 'open',
      remaining_work: 12,
      risk_score: 50
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid job data', () => {
    const result = JobSchema.safeParse({
      job_id: '',
      due_date: '',
      status: 'open',
      remaining_work: '12',
      risk_score: 50
    })

    expect(result.success).toBe(false)
  })

  it('validates operations, resources, and materials', () => {
    expect(
      OperationSchema.safeParse({
        operation_id: 'OP-1',
        job_id: 'JOB-1',
        resource_id: 'WC-1',
        sequence: 10,
        standard_rate: 8,
        actual_rate: 7,
        remaining_time: 3
      }).success
    ).toBe(true)

    expect(
      ResourceSchema.safeParse({
        resource_id: 'WC-1',
        resource_type: 'work_center',
        available_capacity: 20,
        scheduled_load: 18
      }).success
    ).toBe(true)

    expect(
      MaterialRequirementSchema.safeParse({
        job_id: 'JOB-1',
        item_id: 'MAT-1',
        required_qty: 10,
        issued_qty: 5,
        availability_flag: false
      }).success
    ).toBe(true)
  })
})
