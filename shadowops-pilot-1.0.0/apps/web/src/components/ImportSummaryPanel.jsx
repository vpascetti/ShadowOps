import '../styles/DashboardView.css'

export default function ImportSummaryPanel({ importStats }) {
  if (!importStats) {
    return null
  }

  const {
    source,
    snapshotTimestamp,
    totalRows,
    jobsImported,
    warnings = [],
    errors = [],
    schemaVersion,
    importer,
    importStats: stats
  } = importStats

  // Extract stats
  const rowsLoaded = stats?.rowsLoaded || totalRows || 0
  const rowsKept = stats?.rowsKept || jobsImported || 0
  const rowsDropped = stats?.rowsDropped || 0
  const duplicatesRemoved = stats?.duplicatesRemoved || 0
  const dropReasons = stats?.dropReasons || {}

  const hasIssues = warnings.length > 0 || errors.length > 0

  return (
    <div className="import-summary-panel" style={{ 
      margin: '1rem', 
      padding: '1rem', 
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Import Summary</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="import-stat">
          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Source</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{source || 'Unknown'}</div>
          {importer && <div style={{ fontSize: '0.75rem', color: '#868e96' }}>{importer}</div>}
          {schemaVersion && <div style={{ fontSize: '0.75rem', color: '#868e96' }}>v{schemaVersion}</div>}
        </div>

        <div className="import-stat">
          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Snapshot Time</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            {snapshotTimestamp ? new Date(snapshotTimestamp).toLocaleString() : 'N/A'}
          </div>
        </div>

        <div className="import-stat">
          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Rows Loaded</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0d6efd' }}>{rowsLoaded}</div>
        </div>

        <div className="import-stat">
          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Rows Kept</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#198754' }}>{rowsKept}</div>
        </div>

        {rowsDropped > 0 && (
          <div className="import-stat">
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Rows Dropped</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc3545' }}>{rowsDropped}</div>
          </div>
        )}

        {duplicatesRemoved > 0 && (
          <div className="import-stat">
            <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Duplicates Removed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fd7e14' }}>{duplicatesRemoved}</div>
          </div>
        )}
      </div>

      {/* Drop Reasons */}
      {rowsDropped > 0 && Object.keys(dropReasons).length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff3cd', borderLeft: '4px solid #ffc107', borderRadius: '4px' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Drop Reasons:</div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {dropReasons.missingJob > 0 && <li>Missing Job: {dropReasons.missingJob}</li>}
            {dropReasons.missingWorkCenter > 0 && <li>Missing WorkCenter: {dropReasons.missingWorkCenter}</li>}
            {dropReasons.invalidOperationSeq > 0 && <li>Invalid OperationSeq: {dropReasons.invalidOperationSeq}</li>}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#fd7e14' }}>
              Warnings ({warnings.length})
            </summary>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.875rem', maxHeight: '200px', overflow: 'auto' }}>
              {warnings.slice(0, 20).map((w, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>{w}</li>
              ))}
              {warnings.length > 20 && <li style={{ color: '#6c757d' }}>...and {warnings.length - 20} more</li>}
            </ul>
          </details>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8d7da', borderLeft: '4px solid #dc3545', borderRadius: '4px' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#842029' }}>Errors ({errors.length}):</div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#842029' }}>
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {!hasIssues && rowsKept > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d1e7dd', borderLeft: '4px solid #198754', borderRadius: '4px', color: '#0f5132' }}>
          Import completed successfully with no issues
        </div>
      )}
    </div>
  )
}
