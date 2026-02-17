import type { DataProvider } from '@shadowops/core'
import { DbProvider } from './dbProvider.js'
import { IQMSDataProvider } from './iqmsProvider.js'
import { IQMSOracleProvider } from './iqmsOracleProvider.js'
import { StubProvider } from './stubProvider.js'

export const getProvider = (): DataProvider => {
  const providerType = (process.env.DATA_PROVIDER || 'stub').toLowerCase()
  if (providerType === 'db') {
    return new DbProvider()
  }
  if (providerType === 'iqms') {
    if ((process.env.IQMS_CONNECTOR || '').toLowerCase() === 'oracle') {
      return new IQMSOracleProvider()
    }
    return new IQMSDataProvider()
  }
  return new StubProvider()
}
