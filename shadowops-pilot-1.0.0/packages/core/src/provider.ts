import type { Job, MaterialRequirement, Operation, Resource } from './schema.js'

export type JobDetail = {
  job: Job
  operations: Operation[]
  materials: MaterialRequirement[]
  resources: Resource[]
}

export type MetricsSummary = {
  atRiskCount: number
  dueNext7Days: number
  overloadedResourcesCount: number
}

export type JobQuery = {
  status?: string
  dueDateStart?: string
  dueDateEnd?: string
  resourceId?: string
}

export interface DataProvider {
  getJobs(query?: JobQuery): Promise<Job[]>
  getJobById(jobId: string): Promise<JobDetail | null>
  getMetricsSummary(): Promise<MetricsSummary>
}
