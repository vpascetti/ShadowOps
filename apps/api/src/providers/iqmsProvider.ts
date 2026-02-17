import type { DataProvider, JobDetail, JobQuery, MetricsSummary } from '@shadowops/core'
import { IQMSProvider } from '@shadowops/adapters-iqms'

export class IQMSDataProvider implements DataProvider {
  private readonly provider = new IQMSProvider()

  getJobs(query?: JobQuery) {
    return this.provider.getJobs(query)
  }

  getJobById(jobId: string): Promise<JobDetail | null> {
    return this.provider.getJobById(jobId)
  }

  getMetricsSummary(): Promise<MetricsSummary> {
    return this.provider.getMetricsSummary()
  }
}
