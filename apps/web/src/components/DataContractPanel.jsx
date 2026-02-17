import { useMemo } from 'react'

function formatList(list = [], fallback = '—') {
  if (!list.length) return fallback
  return list.join(', ')
}

function downloadWarningsFile(warnings, format) {
  if (!warnings || !warnings.length) return
  let content = ''
  let mime = 'application/json'
  let filename = 'shadowops-warnings.json'
  if (format === 'csv') {
    mime = 'text/csv'
    filename = 'shadowops-warnings.csv'
    content = ['warning', ...warnings.map((w) => `"${String(w).replace(/"/g, '""')}"`)].join('\n')
  } else {
    content = JSON.stringify({ warnings }, null, 2)
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function DataContractPanel({ report }) {
  if (!report) return null

  const warnings = report.warnings || []
  const errors = report.errors || []
  const schemaVersion = report.schemaVersion || '1.0'
  const firstWarnings = warnings.slice(0, 25)
  const remainingWarnings = Math.max(0, warnings.length - firstWarnings.length)

  const recognizedColumns = useMemo(() => {
    if (report.recognizedColumns && report.recognizedColumns.length) return report.recognizedColumns
    if (report.normalizedHeaders && Array.isArray(report.normalizedHeaders)) {
      return report.normalizedHeaders
        .map((h) => h.canonical || h.raw || h)
        .filter(Boolean)
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
    }
    return []
  }, [report])

  return (
    <div className="data-contract-panel">
      <div className="data-contract-header">
        <div>
          <div className="data-contract-title">Data Contract</div>
          <div className="data-contract-sub">Schema version: v{schemaVersion}</div>
        </div>
        <div className="data-contract-meta">
          <span>Rows parsed: {report.totalRows ?? '—'}</span>
          <span>Jobs imported: {report.jobsImported ?? '—'}</span>
          <span>Source: {report.source || 'CSV'}</span>
        </div>
      </div>

      <div className="data-contract-body">
        <div className="data-contract-row">
          <div className="label">Columns recognized</div>
          <div className="value">{formatList(recognizedColumns)}</div>
        </div>
        {report.unknownColumns && report.unknownColumns.length > 0 && (
          <div className="data-contract-row muted">
            <div className="label">Unknown columns</div>
            <div className="value">{formatList(report.unknownColumns)}</div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="data-contract-row warning">
            <div className="label">Warnings ({warnings.length})</div>
            <div className="value">
              <ul className="warning-list">
                {firstWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {remainingWarnings > 0 && (
                <div className="muted">+{remainingWarnings} more not shown</div>
              )}
              <div className="warning-actions">
                <button onClick={() => downloadWarningsFile(warnings, 'csv')}>Download warnings CSV</button>
                <button onClick={() => downloadWarningsFile(warnings, 'json')}>Download warnings JSON</button>
              </div>
            </div>
          </div>
        )}
        {errors.length > 0 && (
          <div className="data-contract-row error">
            <div className="label">Errors ({errors.length})</div>
            <div className="value">
              <ul className="error-list">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <div className="muted">Fix these errors and re-upload to load metrics.</div>
            </div>
          </div>
        )}
        {warnings.length === 0 && errors.length === 0 && (
          <div className="data-contract-row success">
            <div className="label">Validation</div>
            <div className="value">All required columns present. Ready to compute metrics.</div>
          </div>
        )}
      </div>
    </div>
  )
}
