import { describe, expect, it } from 'vitest'
import { calculateRiskScore } from './risk.js'
import type { Job } from './schema.js'

describe('risk scoring', () => {
  it('scores high risk for overdue jobs', () => {
    const job: Job = {
      job_id: 'JOB-1',
      due_date: '2026-02-01',
      status: 'open',
      remaining_work: 10,
      risk_score: 0
    }

    const score = calculateRiskScore(job, { asOf: new Date('2026-02-05') })
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('scores lower risk for distant due dates', () => {
    const job: Job = {
      job_id: 'JOB-2',
      due_date: '2026-03-15',
      status: 'open',
      remaining_work: 10,
      risk_score: 0
    }

    const score = calculateRiskScore(job, { asOf: new Date('2026-02-05') })
    expect(score).toBeLessThanOrEqual(25)
  })

  it('adds capacity pressure when overloaded', () => {
    const job: Job = {
      job_id: 'JOB-3',
      due_date: '2026-02-20',
      status: 'open',
      remaining_work: 50,
      risk_score: 0
    }

    const score = calculateRiskScore(job, {
      asOf: new Date('2026-02-05'),
      availableCapacity: 20
    })

    expect(score).toBeGreaterThan(0)
  })
})
