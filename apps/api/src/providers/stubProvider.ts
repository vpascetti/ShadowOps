import {
  calculateRiskScore,
  type DataProvider,
  type Job,
  type JobDetail,
  type JobQuery,
  type MetricsSummary
} from '@shadowops/core'
import fixtures from './stubFixtures.json'

const toDate = (value: string) => new Date(value)

const applyJobFilters = (jobs: Job[], query?: JobQuery) => {
  if (!query) return jobs
  return jobs.filter((job) => {
    if (query.status && job.status !== query.status) {
      return false
    }
    if (query.dueDateStart) {
      if (toDate(job.due_date) < toDate(query.dueDateStart)) return false
    }
    if (query.dueDateEnd) {
      if (toDate(job.due_date) > toDate(query.dueDateEnd)) return false
    }
    if (query.resourceId) {
      const operation = fixtures.operations.find(
        (op) => op.job_id === job.job_id && op.resource_id === query.resourceId
      )
      if (!operation) return false
    }
    return true
  })
}

const computeRiskScores = (jobs: Job[]): Job[] => {
  return jobs.map((job) => {
    const operation = fixtures.operations.find((op) => op.job_id === job.job_id)
    const resource = fixtures.resources.find(
      (res) => res.resource_id === operation?.resource_id
    )
    const availableCapacity = resource?.available_capacity

    return {
      ...job,
      risk_score: calculateRiskScore(job, { availableCapacity })
    }
  })
}

export class StubProvider implements DataProvider {
  async getJobs(query?: JobQuery): Promise<Job[]> {
    const baseJobs = computeRiskScores(fixtures.jobs as Job[])
    const filtered = applyJobFilters(baseJobs, query)
    return filtered.sort((a, b) => b.risk_score - a.risk_score)
  }

  async getJobById(jobId: string): Promise<JobDetail | null> {
    const job = computeRiskScores(fixtures.jobs as Job[]).find(
      (item) => item.job_id === jobId
    )
    if (!job) return null

    return {
      job,
      operations: fixtures.operations.filter((op) => op.job_id === jobId),
      materials: fixtures.materials.filter((mat) => mat.job_id === jobId),
      resources: fixtures.resources
    }
  }

  async getMetricsSummary(): Promise<MetricsSummary> {
    const jobs = await this.getJobs()
    const asOf = new Date()

    const atRiskCount = jobs.filter((job) => job.risk_score >= 70).length
    const dueNext7Days = jobs.filter((job) => {
      const due = toDate(job.due_date)
      const diff = (due.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    }).length

    const overloadedResourcesCount = (fixtures.resources || []).filter(
      (res) => res.scheduled_load > res.available_capacity
    ).length

    return {
      atRiskCount,
      dueNext7Days,
      overloadedResourcesCount
    }
  }
}
