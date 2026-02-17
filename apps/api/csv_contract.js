import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaV1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/csv-schema-v1.json'), 'utf-8'))
const aliasesV1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/csv-aliases-v1.json'), 'utf-8'))

const REQUIRED = schemaV1.required || []
const OPTIONAL = schemaV1.optional || []
const CANONICAL = [...REQUIRED, ...OPTIONAL]

// Build normalized alias lookup
const aliasLookup = (() => {
  const map = {}
  const aliases = aliasesV1.aliases || {}
  CANONICAL.forEach((canonical) => {
    const variations = [canonical, ...(aliases[canonical] || [])]
    variations.forEach((v) => {
      map[normalizeHeaderKey(v)] = canonical
    })
  })
  return map
})()

export const CSV_SCHEMA_VERSION = schemaV1.version || '1.0'

// Normalize a header string for matching
export function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// Resolve a raw header to canonical header name (or null)
function resolveCanonicalHeader(rawHeader) {
  const norm = normalizeHeaderKey(rawHeader)
  return aliasLookup[norm] || null
}

// Build a map of canonical header -> raw header from the uploaded CSV
export function buildHeaderMap(headers = []) {
  const normalizedHeaders = []
  const headerMap = {}

  headers.forEach((h) => {
    const canonical = resolveCanonicalHeader(h)
    const normalized = normalizeHeaderKey(h)
    normalizedHeaders.push({ raw: h, normalized, canonical })
    if (canonical && !headerMap[canonical]) {
      headerMap[canonical] = h
    }
  })

  const recognizedColumns = Object.keys(headerMap)
  const unknownColumns = normalizedHeaders.filter((h) => !h.canonical).map((h) => h.raw)

  return { headerMap, recognizedColumns, normalizedHeaders, unknownColumns }
}

// Parse dates with supported formats
export function parseFlexibleDate(value) {
  if (value === null || value === undefined) return { valid: false, iso: null, raw: value }
  const raw = String(value).trim()
  if (!raw) return { valid: false, iso: null, raw: value }

  const direct = new Date(raw)
  if (!isNaN(direct.getTime())) {
    const iso = direct.toISOString().split('T')[0]
    return { valid: true, iso, raw: value }
  }

  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const parts = dash || slash
  if (parts) {
    const [, mm, dd, yyyy] = parts
    const isoStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const parsed = new Date(isoStr)
    if (!isNaN(parsed.getTime())) {
      return { valid: true, iso: isoStr, raw: value }
    }
  }

  return { valid: false, iso: null, raw: value }
}

function coerceNumber(val) {
  if (val === null || val === undefined || val === '') return null
  const cleaned = String(val).replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// Generate a stable numeric job_id
function deriveJobId(jobValue) {
  const parsed = parseInt(jobValue, 10)
  if (!isNaN(parsed)) return parsed
  return Math.abs(String(jobValue || '')
    .split('')
    .reduce((sum, char) => Math.imul(31, sum) + char.charCodeAt(0) | 0, 0))
}

export function normalizeAndValidateRows(rows, headerMap) {
  const warnings = []
  const errors = []

  // Required header presence
  const missingRequired = REQUIRED.filter((h) => !headerMap[h])
  if (missingRequired.length) {
    missingRequired.forEach((col) => {
      const aliases = aliasesV1.aliases?.[col] || []
      errors.push(`Missing required column ${col}. Accepted aliases: ${[col, ...aliases].join(', ')}`)
    })
  }

  // Note missing optional headers (non-fatal)
  OPTIONAL.filter((h) => !headerMap[h]).forEach((col) => {
    warnings.push(`Optional column ${col} not provided. This is fine, but related metrics may be blank.`)
  })

  if (errors.length) {
    return { jobs: [], warnings, errors, rowsParsed: rows.length }
  }

  const jobs = []
  rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2 // +2 to account for header row in CSV
    const canonicalRow = {}

    CANONICAL.forEach((col) => {
      const rawKey = headerMap[col]
      const rawVal = rawKey ? rawRow[rawKey] : rawRow[col]
      canonicalRow[col] = typeof rawVal === 'string' ? rawVal.trim() : rawVal
    })

    // Core validations
    const jobVal = canonicalRow.Job
    const wcVal = canonicalRow.WorkCenter
    if (!jobVal) {
      warnings.push(`Row ${rowNumber}: Missing Job. Row skipped.`)
      return
    }
    if (!wcVal) {
      warnings.push(`Row ${rowNumber}: Missing WorkCenter. Row skipped.`)
      return
    }

    // Dates
    const start = parseFlexibleDate(canonicalRow.StartDate)
    const due = parseFlexibleDate(canonicalRow.DueDate)
    if (!due.valid) {
      warnings.push(`Row ${rowNumber}: DueDate is missing or unparseable (${canonicalRow.DueDate || 'blank'}). Row skipped.`)
      return
    }
    if (!start.valid) {
      warnings.push(`Row ${rowNumber}: StartDate is missing or unparseable (${canonicalRow.StartDate || 'blank'}). Using blank.`)
    }

    // Build normalized job record
    const job = {
      job_id: deriveJobId(jobVal),
      job: jobVal,
      work_center: wcVal,
      customer: canonicalRow.Customer || null,
      part: canonicalRow.Part || null,
      start_date: start.valid ? new Date(start.iso) : null,
      due_date: new Date(due.iso),
      qty_released: coerceNumber(canonicalRow.QtyReleased),
      qty_completed: coerceNumber(canonicalRow.QtyCompleted),
      reason: canonicalRow.Reason || null,
      root_cause: canonicalRow.RootCause || null,
      accountable: canonicalRow.Accountable || null,
      projected: canonicalRow.Projected || null,
      timeline: canonicalRow.Timeline || null,
      status: canonicalRow.Status || null,
    }

    jobs.push(job)
  })

  if (!jobs.length) {
    errors.push('No valid rows remained after validation. Please fix required fields and re-upload.')
  }

  return {
    jobs,
    warnings,
    errors,
    rowsParsed: rows.length,
  }
}

export function normalizeCsvPayload(parsed) {
  const headers = parsed.meta?.fields || []
  const rows = parsed.data || []
  const { headerMap, recognizedColumns, normalizedHeaders, unknownColumns } = buildHeaderMap(headers)
  const result = normalizeAndValidateRows(rows, headerMap)

  return {
    ...result,
    recognizedColumns,
    normalizedHeaders,
    unknownColumns,
    schemaVersion: CSV_SCHEMA_VERSION,
    detectedHeaders: headers,
  }
}
