import type { DataProvider, JobDetail, JobQuery, MetricsSummary } from '@shadowops/core'

export class IQMSProvider implements DataProvider {
  async getJobs(_query?: JobQuery) {
    return []
  }

  async getJobById(_jobId: string): Promise<JobDetail | null> {
    return null
  }

  async getMetricsSummary(): Promise<MetricsSummary> {
    return {
      atRiskCount: 0,
      dueNext7Days: 0,
      overloadedResourcesCount: 0
    }
  }
}
