import { describe, it, expect, beforeEach } from 'vitest'
import {
  forecastCompletion,
  detectAnomalies,
  detectImmediateIssues,
  type JobSnapshot,
  type PredictionResult,
} from './predictions'
import type { Job } from './schema'

describe('Predictive Analytics', () => {
  describe('Velocity-Based Forecasting', () => {
    let mockJob: Job
    let mockSnapshots: JobSnapshot[]
    const now = new Date('2024-02-20T12:00:00Z')

    beforeEach(() => {
      mockJob = {
        job_id: 'JOB-001',
        due_date: '2024-02-27T00:00:00Z', // 7 days from now
        status: 'On Track',
        remaining_work: 20, // 20 hours left
        risk_score: 25,
      }

      // Create snapshots showing steady progress
      mockSnapshots = [
        {
          snapshot_date: new Date('2024-02-10T12:00:00Z'),
          hours_to_go: 60,
          qty_completed: 0,
          status: 'In Progress',
        },
        {
          snapshot_date: new Date('2024-02-13T12:00:00Z'),
          hours_to_go: 45,
          qty_completed: 15,
          status: 'In Progress',
        },
        {
          snapshot_date: new Date('2024-02-16T12:00:00Z'),
          hours_to_go: 30,
          qty_completed: 30,
          status: 'In Progress',
        },
        {
          snapshot_date: new Date('2024-02-19T12:00:00Z'),
          hours_to_go: 20,
          qty_completed: 40,
          status: 'In Progress',
        },
      ]
    })

    it('should predict on-time completion with steady velocity', () => {
      const result = forecastCompletion(mockJob, mockSnapshots, { asOf: now })

      expect(result.method).toBe('velocity')
      expect(result.predicted_lateness_days).toBeLessThanOrEqual(1) // Should be on time or slightly early
      expect(result.confidence_score).toBeGreaterThan(0.7)
      expect(result.basis).toContain('hrs/day')
    })

    it('should predict lateness when velocity is too slow', () => {
      // Change job to be due sooner
      mockJob.due_date = '2024-02-22T00:00:00Z' // Only 2 days away
      mockJob.remaining_work = 30 // Still has 30 hours

      const result = forecastCompletion(mockJob, mockSnapshots, { asOf: now })

      expect(result.predicted_lateness_days).toBeGreaterThan(0)
    })

    it('should have low confidence with insufficient data', () => {
      const tooFewSnapshots = mockSnapshots.slice(0, 1)
      const result = forecastCompletion(mockJob, tooFewSnapshots, { asOf: now })

      expect(result.confidence_score).toBeLessThan(0.5)
      expect(result.basis).toContain('Insufficient historical data')
    })

    it('should handle completed jobs', () => {
      mockJob.remaining_work = 0
      const result = forecastCompletion(mockJob, mockSnapshots, { asOf: now })

      expect(result.predicted_completion_date).toEqual(now)
      expect(result.predicted_lateness_days).toBe(0)
      expect(result.confidence_score).toBe(1.0)
    })

    it('should detect stalled job (no progress)', () => {
      // All snapshots show same hours_to_go within lookback period
      const stalledSnapshots: JobSnapshot[] = [
        {
          snapshot_date: new Date('2024-02-16T12:00:00Z'),
          hours_to_go: 60,
          qty_completed: 0,
          status: 'In Progress',
        },
        {
          snapshot_date: new Date('2024-02-19T12:00:00Z'),
          hours_to_go: 60, // No progress!
          qty_completed: 0,
          status: 'In Progress',
        },
      ]

      const result = forecastCompletion(mockJob, stalledSnapshots, { asOf: now })
      expect(result.basis).toContain('No progress detected')
    })
  })

  describe('Anomaly Detection', () => {
    const now = new Date()

    it('should detect throughput slowdown', () => {
      const metrics = [
        { metric_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), throughput: 100 },
        { metric_date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), throughput: 95 },
        { metric_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), throughput: 90 },
        { metric_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), throughput: 50 }, // Significant drop
      ]

      const alerts = detectAnomalies('CNC-01', metrics, { stdDevThreshold: 1 })
      const slowdownAlert = alerts.find((a) => a.type === 'slowdown')

      expect(slowdownAlert).toBeDefined()
      expect(slowdownAlert?.severity).toBe('high')
      expect(slowdownAlert?.deviation_percent).toBeGreaterThan(30)
    })

    it('should detect queue buildup', () => {
      const metrics = [
        { metric_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), queue_depth: 2 },
        { metric_date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), queue_depth: 3 },
        { metric_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), queue_depth: 5 },
        { metric_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), queue_depth: 8 },
        { metric_date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), queue_depth: 12 }, // Upward trend
      ]

      const alerts = detectAnomalies('WELD-02', metrics, { stdDevThreshold: 1 })
      const queueAlert = alerts.find((a) => a.type === 'queue_buildup')

      expect(queueAlert).toBeDefined()
      expect(queueAlert?.severity).toBeDefined()
    })

    it('should detect elevated scrap rate', () => {
      const metrics = [
        { metric_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), scrap_rate: 0.01 },
        { metric_date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), scrap_rate: 0.015 },
        { metric_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), scrap_rate: 0.02 },
        { metric_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), scrap_rate: 0.08 }, // Big jump
      ]

      const alerts = detectAnomalies('PAINT-01', metrics, { stdDevThreshold: 1 })
      const scrapAlert = alerts.find((a) => a.type === 'unusual_pattern')

      expect(scrapAlert).toBeDefined()
    })

    it('should not flag normal variations', () => {
      const metrics = [
        { metric_date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), throughput: 100 },
        { metric_date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), throughput: 102 },
        { metric_date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), throughput: 98 },
        { metric_date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), throughput: 101 },
        { metric_date: now, throughput: 99 },
      ]

      const alerts = detectAnomalies('CNC-03', metrics)
      expect(alerts).toHaveLength(0)
    })
  })

  describe('Immediate Issue Detection', () => {
    const mockJob: Job = {
      job_id: 'JOB-002',
      due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Already late
      status: 'Late',
      remaining_work: 25,
      risk_score: 90,
    }

    it('should flag already late jobs', () => {
      const issues = detectImmediateIssues(mockJob, null, null)
      const lateIssue = issues.find((i) => i.issue.includes('LATE'))

      expect(lateIssue).toBeDefined()
      expect(lateIssue?.severity).toBe('critical')
    })

    it('should flag stalled jobs (no progress)', () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const latestSnapshot: JobSnapshot = {
        snapshot_date: now,
        hours_to_go: 50,
        qty_completed: 0,
        status: 'In Progress',
      }

      const previousSnapshot: JobSnapshot = {
        snapshot_date: yesterday,
        hours_to_go: 50,
        qty_completed: 0,
        status: 'In Progress',
      }

      const issues = detectImmediateIssues(mockJob, latestSnapshot, previousSnapshot)
      const stalledIssue = issues.find((i) => i.issue.includes('stalled'))

      expect(stalledIssue).toBeDefined()
      expect(stalledIssue?.severity).toBe('critical')
    })

    it('should flag jobs expiring soon with work remaining', () => {
      const urgentJob: Job = {
        ...mockJob,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        remaining_work: 20, // Significant work
        status: 'In Progress',
      }

      const issues = detectImmediateIssues(urgentJob, null, null)
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].severity).toBe('critical')
    })

    it('should not flag jobs on track', () => {
      const onTrackJob: Job = {
        ...mockJob,
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days away
        remaining_work: 5, // Minimal work
        status: 'On Track',
      }

      const issues = detectImmediateIssues(onTrackJob, null, null)
      expect(issues).toHaveLength(0)
    })
  })
})
