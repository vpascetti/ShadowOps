import React from 'react'

export function PredictionBadge({ forecast, issues, riskLevel }) {
  if (!forecast && !issues) return null

  const getColor = () => {
    if (riskLevel === 'critical') return 'bg-red-500'
    if (riskLevel === 'urgent') return 'bg-orange-500'
    if (riskLevel === 'warning') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getIcon = () => {
    if (riskLevel === 'critical') return '🔴'
    if (riskLevel === 'urgent') return '⚠️'
    if (riskLevel === 'warning') return '⏸️'
    return '✅'
  }

  if (!riskLevel || riskLevel === 'normal') return null

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-white"
         style={{
           backgroundColor: getColor() === 'bg-red-500' ? '#ef4444' :
                           getColor() === 'bg-orange-500' ? '#f97316' :
                           getColor() === 'bg-yellow-500' ? '#eab308' : '#22c55e'
         }}>
      <span>{getIcon()}</span>
      <span>{riskLevel.toUpperCase()}</span>
    </div>
  )
}

export function ForecastCard({ forecast, compact = false }) {
  if (!forecast || forecast.predicted_completion_date === null) {
    return null
  }

  const daysLate = forecast.predicted_lateness_days
  const confidence = (forecast.confidence_score * 100).toFixed(0)
  const completionDate = new Date(forecast.predicted_completion_date)

  if (compact) {
    return (
      <div className="text-sm p-2 bg-blue-50 border border-blue-200 rounded">
        <div className="font-semibold text-blue-900">Forecast</div>
        <div className="text-blue-800">
          {daysLate > 0 
            ? `🔴 ${daysLate} days late` 
            : '✅ On time'}
        </div>
        <div className="text-xs text-blue-700 mt-1">
          Completion: {completionDate.toLocaleDateString()}
        </div>
        <div className="text-xs text-blue-700">
          Confidence: {confidence}%
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-lg">
      <h3 className="font-bold text-blue-900 mb-3">📊 Job Forecast</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-blue-700 font-semibold">PREDICTED COMPLETION</div>
          <div className="text-lg font-bold text-blue-900">
            {completionDate.toLocaleDateString()}
          </div>
        </div>
        
        <div>
          <div className="text-xs text-blue-700 font-semibold">LATENESS PREDICTION</div>
          <div className={`text-lg font-bold ${daysLate > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {daysLate > 0 ? `${daysLate} days late` : 'On time'}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <div className="text-xs text-blue-700 font-semibold">CONFIDENCE</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600" 
              style={{ width: `${forecast.confidence_score * 100}%` }}
            />
          </div>
          <div className="text-sm font-semibold text-blue-900">{confidence}%</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-blue-700 italic">
        {forecast.basis}
      </div>
    </div>
  )
}

export function IssuesAlert({ issues }) {
  if (!issues || issues.length === 0) return null

  return (
    <div className="space-y-2">
      {issues.map((issue, idx) => (
        <div 
          key={idx}
          className={`p-3 rounded-lg border-l-4 ${
            issue.type === 'critical'
              ? 'bg-red-50 border-l-red-600 text-red-900'
              : issue.type === 'urgent'
              ? 'bg-orange-50 border-l-orange-600 text-orange-900'
              : 'bg-yellow-50 border-l-yellow-600 text-yellow-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{issue.icon}</span>
            <div>
              <div className="font-semibold">{issue.type.toUpperCase()}</div>
              <div className="text-sm mt-1">{issue.message}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AnomalyAlert({ anomaly }) {
  const bgColor = anomaly.severity === 'high'
    ? 'bg-red-50'
    : anomaly.severity === 'medium'
    ? 'bg-orange-50'
    : 'bg-yellow-50'

  const borderColor = anomaly.severity === 'high'
    ? 'border-red-300'
    : anomaly.severity === 'medium'
    ? 'border-orange-300'
    : 'border-yellow-300'

  const textColor = anomaly.severity === 'high'
    ? 'text-red-900'
    : anomaly.severity === 'medium'
    ? 'text-orange-900'
    : 'text-yellow-900'

  return (
    <div className={`${bgColor} border ${borderColor} rounded p-3`}>
      <div className={`flex items-start gap-2 ${textColor}`}>
        <span className="text-xl">{anomaly.icon}</span>
        <div>
          <div className="font-semibold text-sm">{anomaly.type.toUpperCase()}</div>
          <div className="text-sm mt-1">{anomaly.message}</div>
        </div>
      </div>
    </div>
  )
}

export function AnomaliesPanel({ anomalies }) {
  if (!anomalies || Object.keys(anomalies).length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded text-green-900 text-center">
        <div className="text-2xl mb-2">✅</div>
        <div className="font-semibold">All Clear</div>
        <div className="text-sm">No anomalies detected in the last 24 hours</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(anomalies).map(([workCenter, alerts]) => (
        <div key={workCenter} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="font-bold text-gray-900 mb-3">{workCenter}</div>
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <AnomalyAlert key={idx} anomaly={alert} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
