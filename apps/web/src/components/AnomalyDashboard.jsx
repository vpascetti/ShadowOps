import React, { useState, useEffect } from 'react'
import { AnomaliesPanel } from './PredictionCards'

export function AnomalyDashboard() {
  const [anomalies, setAnomalies] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshTime, setRefreshTime] = useState(new Date())

  const fetchAnomalies = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('tenant_token')
      const response = await fetch('/api/anomalies/dashboard?lookbackDays=7', {
        headers: token ? { 'x-tenant-token': token } : {}
      })
      
      if (!response.ok) throw new Error('Failed to fetch anomalies')
      
      const data = await response.json()
      setAnomalies(data.anomalies)
      setRefreshTime(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching anomalies:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnomalies()
    // Refresh every 5 minutes
    const interval = setInterval(fetchAnomalies, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">🔍 Work Center Anomalies</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Last updated: {refreshTime.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchAnomalies}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-900 text-sm mb-4">
          Error: {error}
        </div>
      )}

      {loading && anomalies === null ? (
        <div className="p-4 text-center text-gray-500">Loading...</div>
      ) : (
        <AnomaliesPanel anomalies={anomalies} />
      )}
    </div>
  )
}
