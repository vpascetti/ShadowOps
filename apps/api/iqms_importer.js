// IQMS Schedule Summary V1 Importer
import Papa from 'papaparse'

// Header normalization utility
export function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[.,:#]/g, ' ')
    .replace(/\s+/g, ' ')
}

// Detect IQMS Schedule Summary V1 by normalized headers
export function isIQMSScheduleSummaryV1(headers) {
  const norm = headers.map(normalizeHeader)
  const has = (h) => norm.includes(h)
  return (
    has('wo number') &&
    has('work center number') &&
    has('cycles required') &&
    has('parts to go') &&
    (has('scheduled end date') || has('must end date'))
  )
}

// Flexible date parser (handles ISO, MM-DD-YYYY, MM/DD/YYYY)
function parseDateFlexible(value) {
  if (!value) return null
  const str = String(value).trim()
  if (!str) return null
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed
  const mdyDash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/
  const mdySlash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  let m
  if ((m = str.match(mdyDash)) || (m = str.match(mdySlash))) {
    const [, mm, dd, yyyy] = m
    const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

// Canonical mapping for IQMS Schedule Summary V1
function mapIQMSScheduleSummaryV1Row(row, headerMap) {
  // Helper to get by normalized header
  const get = (norm) => {
    const headerKey = headerMap[norm]
    if (!headerKey) {
      // Try finding header with that norm by searching through headerMap keys
      for (const [key, val] of Object.entries(headerMap)) {
        if (key === norm) return row[val]
      }
      return undefined
    }
    return row[headerKey]
  }
  const jobIdRaw = get('wo number')
  const jobId = String(jobIdRaw)
  const workCenter = get('work center number')
  const part = get('item number')
  const partDesc = get('item description')
  const customer = get('customer') || null
  const startDateRaw = get('start date') || null
  
  // Parse parts-related fields
  const cyclesRequired = parseFloat(get('cycles required'))
  const releaseQty = parseFloat(get('release qty')) || parseFloat(get('released qty'))
  const partsToGo = parseFloat(get('parts to go'))
  
  // Calculate total parts and parts completed
  // Note: cycles and parts are different units due to cavitation
  let totalParts = null
  let qtyReleased = releaseQty || cyclesRequired  // Prefer Release Qty, fall back to Cycles Required
  let qtyCompleted = null
  
  if (!isNaN(partsToGo)) {
    // If we have parts to go, we can work backwards
    // We don't have total parts directly, but partsToGo gives us remaining work
    qtyCompleted = 0  // We'll calculate this if we get more info
    totalParts = partsToGo  // At minimum, this many parts
  }
  
  if ((!isNaN(qtyReleased) || !isNaN(cyclesRequired)) && !isNaN(partsToGo)) {
    // Use partsToGo as the remaining work
    // We can't calculate completion without knowing total parts expected
    // So we'll store both values for now
    qtyCompleted = 0  // Unknown without total
  }
  
  const dueDateRaw = get('must end date') || get('scheduled end date') || null
  let dueDate = dueDateRaw ? parseDateFlexible(dueDateRaw) : null
  let startDate = startDateRaw ? parseDateFlexible(startDateRaw) : null
  let hoursToGo = parseFloat(get('hoursto go'))
  if (isNaN(hoursToGo)) hoursToGo = null
  let availableHours = parseFloat(get('available hours'))
  if (isNaN(availableHours)) availableHours = null
  return {
    jobId,
    workCenter,
    customer,
    part,
    partDesc,
    startDate: startDate ? startDate.toISOString() : null,
    qtyReleased,
    partsToGo,
    qtyCompleted,
    dueDate: dueDate ? dueDate.toISOString() : null,
    scheduledEndDate: get('scheduled end date') || null,
    mustEndDate: get('must end date') || null,
    hoursToGo,
    availableHours,
    _raw: row
  }
}


// Filter, collapse, and store ops for IQMS Schedule Summary V1
function collapseIQMSJobs(rows, headerMap) {
  // Filtering rules
  const filtered = rows.filter(row => {
    const jobId = row[headerMap['wo number']]
    const workCenter = row[headerMap['work center number']]
    const qtyReleased = row[headerMap['cycles required']]
    const partsToGo = row[headerMap['parts to go']]
    const partDesc = (row[headerMap['item description']] || '').toLowerCase()
    if (!jobId || isNaN(Number(jobId))) return false
    if (!workCenter) return false
    if ((qtyReleased === undefined || qtyReleased === '' || isNaN(Number(qtyReleased))) && (partsToGo === undefined || partsToGo === '' || isNaN(Number(partsToGo)))) return false
    if (partDesc.includes('down-time')) return false
    return true
  })
  // Group by jobId
  const byJob = {}
  for (const row of filtered) {
    const jobId = String(row[headerMap['wo number']])
    if (!byJob[jobId]) byJob[jobId] = []
    byJob[jobId].push(row)
  }
  // Collapse: pick earliest dueDate, then largest hoursToGo
  const canonical = []
  for (const jobId in byJob) {
    const ops = byJob[jobId].map(row => mapIQMSScheduleSummaryV1Row(row, headerMap))
    let best = ops[0]
    for (const op of ops) {
      if (!best.dueDate && op.dueDate) { best = op; continue }
      if (op.dueDate && best.dueDate && op.dueDate < best.dueDate) { best = op; continue }
      if ((!op.dueDate && !best.dueDate) && (op.hoursToGo > best.hoursToGo)) { best = op; continue }
    }
    best.ops = ops
    canonical.push(best)
  }
  return canonical
}


// Main IQMS Schedule Summary V1 importer
export function importIQMSScheduleSummaryV1(csvStr) {
  const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true })
  const rows = parsed.data || []
  const headers = parsed.meta.fields || []
  const normHeaders = headers.map(normalizeHeader)
  // Map normalized header to original
  const headerMap = {}
  for (let i = 0; i < headers.length; ++i) headerMap[normHeaders[i]] = headers[i]
  if (!isIQMSScheduleSummaryV1(headers)) {
    throw new Error('Not an IQMS Schedule Summary V1 CSV')
  }
  const canonical = collapseIQMSJobs(rows, headerMap)
  // Warnings and clamping
  const warnings = []
  for (const job of canonical) {
    if (typeof job.qtyCompleted === 'number' && typeof job.qtyReleased === 'number') {
      if (job.qtyCompleted < 0) { 
        warnings.push(`Job ${job.jobId}: qtyCompleted was ${job.qtyCompleted}, clamped to 0`)
        job.qtyCompleted = 0 
      }
      if (job.qtyCompleted > job.qtyReleased) { 
        warnings.push(`Job ${job.jobId}: qtyCompleted (${job.qtyCompleted}) > qtyReleased (${job.qtyReleased}), clamped to ${job.qtyReleased}`)
        job.qtyCompleted = job.qtyReleased 
      }
    }
    // Note: partsToGo can exceed cycles due to multi-cavity molds (cavitation)
    // This is expected and should not be clamped
    if (!job.dueDate) { warnings.push(`Job ${job.jobId}: dueDate missing, marked as unknown due`) }
  }
  // Clean up circular references before returning
  const cleanJobs = canonical.map(job => {
    const { _raw, ops, ...cleaned } = job
    return cleaned
  })
  
  return {
    jobs: cleanJobs,
    warnings,
    totalRows: rows.length,
    importer: 'IQMS_SCHEDULE_SUMMARY_V1',
    detectedHeaders: headers,
    normalizedHeaders: normHeaders,
    sampleJobs: cleanJobs.slice(0, 3)
  }
}
