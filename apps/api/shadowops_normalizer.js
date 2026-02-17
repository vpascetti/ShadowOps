/**
 * ShadowOps Export CSV Normalization Layer
 * Version: 1.0 (ShadowOps Export)
 * 
 * This module provides robust CSV normalization for the "ShadowOps Export" format from Crystal.
 * It handles header aliases, data type coercion, row filtering, and deduplication.
 */

// ============================================================================
// CANONICAL FIELD DEFINITIONS
// ============================================================================

/**
 * Canonical output fields from normalizeRow()
 */
export const CANONICAL_FIELDS = {
  // Job identification
  job: 'string',
  customer: 'string',
  poNumber: 'string|null',
  itemNumber: 'string|null',
  description: 'string|null',
  
  // Quantities and dates
  deliveryQty: 'number|null',
  qtyReleased: 'number|null',    // Quantity released to shop floor
  qtyCompleted: 'number|null',   // Quantity completed
  dueDate: 'Date|null',         // Renamed from Promise Date in Crystal
  requestDate: 'Date|null',
  shipDate: 'Date|null',
  
  // Operation details
  workCenter: 'string',
  operationSeq: 'number',
  schedColor: 'string|null',
  firmFlag: 'boolean|null',
  workOrderId: 'number|null',
  
  // Schedule details
  cyclesToGo: 'number|null',
  hoursToGo: 'number|null',
  startTime: 'Date|null',
  endTime: 'Date|null',
}

// ============================================================================
// HEADER ALIAS MAPPING
// ============================================================================

/**
 * Maps various header aliases to canonical field names.
 * Each canonical field can be recognized by multiple header variations.
 */
export const HEADER_ALIASES = {
  job: ["Job", "Order No.", "ORDERNO", "WO No.", "Work Order No."],
  customer: ["Customer", "Customer ", "@Customer Name"],
  poNumber: ["PO Number", "PONO", "PONumber"],
  itemNumber: ["Item Number", "ITEMNO", "Mfg No.", "Mfg No.:", "ItemNumber", "MfgNumber"],
  description: ["Description", "DESCRIP"],
  deliveryQty: ["Delivery Quantity", "DeliveryQuantity", "REL_QUAN"],
  qtyReleased: ["QtyReleased", "Qty Released", "RELEASED_QTY"],
  qtyCompleted: ["QtyCompleted", "Qty Completed", "COMPLETED_QTY"],
  dueDate: ["DueDate", "Promise Date", "@PromiseDateOnly"],
  shipDate: ["Ship Date", "@ShipDate"],
  requestDate: ["Request Date", "@RequestDateOnly"],
  workCenter: ["WorkCenter", "Work Center", "EQNO"],
  operationSeq: ["OperationSeq", "Seq", "Seq:", "CNTR_SEQ", "CNTR_"],
  schedColor: ["Sched Color", "Sched Color:", "@sched color"],
  firmFlag: ["Firm", "Firm:", "FirmFlag"],
  workOrderId: ["WorkOrderID", "WORKORDER_ID", "Work Order:", "Work Order"],
  cyclesToGo: ["CyclesToGo", "Cycles To Go", "CYCLES_TO_GO"],
  hoursToGo: ["HoursToGo", "HrsToGo", "Hrs To Go", "Hrs To Go:", "HOURS_TO_GO"],
  startTime: ["StartTime", "Start Time", "Start Time:"],
  endTime: ["EndTime", "End Time", "End Time:"],
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalize header string for consistent matching
 * Removes trailing spaces, special characters, and normalizes case
 */
function normalizeHeaderKey(str) {
  return String(str || '')
    .trim()
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Build lookup table from raw headers to canonical field names
 */
function buildHeaderLookup(rawHeaders) {
  const lookup = {}
  const reverseMap = {} // canonical -> raw header
  const normalizedHeaders = []
  
  // Build alias lookup (normalized -> canonical)
  const aliasLookup = {}
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const normalized = normalizeHeaderKey(alias).toLowerCase()
      aliasLookup[normalized] = canonical
    }
  }
  
  // Map raw headers to canonical fields
  for (const rawHeader of rawHeaders) {
    const trimmed = normalizeHeaderKey(rawHeader)
    const normalized = trimmed.toLowerCase()
    const canonical = aliasLookup[normalized]
    normalizedHeaders.push({ raw: rawHeader, normalized, canonical })
    
    if (canonical && !reverseMap[canonical]) {
      reverseMap[canonical] = rawHeader
      lookup[rawHeader] = canonical
    }
  }

  const unknownColumns = normalizedHeaders
    .filter((h) => !h.canonical)
    .map((h) => h.raw)
  
  return { lookup, reverseMap, normalizedHeaders, unknownColumns }
}

/**
 * Parse date safely (handles multiple formats)
 * Supports: YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY, ISO datetime
 */
function parseDateSafe(value) {
  if (value === null || value === undefined || value === '') return null
  
  const str = String(value).trim()
  if (!str) return null
  
  // Try standard Date constructor first
  const direct = new Date(str)
  if (!isNaN(direct.getTime())) {
    return direct
  }
  
  // Try MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  const parts = slashMatch || dashMatch
  
  if (parts) {
    const [, mm, dd, yyyy] = parts
    const isoStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const parsed = new Date(isoStr)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }
  
  return null
}

/**
 * Parse number safely (strips commas, handles blanks)
 */
function parseNumberSafe(value) {
  if (value === null || value === undefined || value === '') return null
  
  const cleaned = String(value).replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  
  return isNaN(num) ? null : num
}

/**
 * Parse boolean safely
 */
function parseBooleanSafe(value) {
  if (value === null || value === undefined || value === '') return null
  
  const str = String(value).trim().toLowerCase()
  if (str === 'true' || str === '1' || str === 'y' || str === 'yes' || str === 't') {
    return true
  }
  if (str === 'false' || str === '0' || str === 'n' || str === 'no' || str === 'f') {
    return false
  }
  
  return null
}

// ============================================================================
// CORE NORMALIZATION
// ============================================================================

/**
 * Normalize a single CSV row to canonical format
 * 
 * @param {Object} rawRow - Raw CSV row object (keys are original headers)
 * @param {Object} reverseMap - Map of canonical field -> raw header
 * @returns {Object} Normalized row with canonical keys
 */
export function normalizeRow(rawRow, reverseMap) {
  const normalized = {}
  
  // Helper to get raw value by canonical field name
  const getRaw = (canonical) => {
    const rawHeader = reverseMap[canonical]
    if (!rawHeader) return null
    const value = rawRow[rawHeader]
    return typeof value === 'string' ? value.trim() : value
  }
  
  // String fields
  normalized.job = getRaw('job') || null
  normalized.customer = getRaw('customer') || null
  normalized.poNumber = getRaw('poNumber') || null
  normalized.itemNumber = getRaw('itemNumber') || null
  normalized.description = getRaw('description') || null
  normalized.workCenter = getRaw('workCenter') || null
  normalized.schedColor = getRaw('schedColor') || null
  
  // Numeric fields
  normalized.deliveryQty = parseNumberSafe(getRaw('deliveryQty'))
  normalized.cyclesToGo = parseNumberSafe(getRaw('cyclesToGo'))
  normalized.operationSeq = parseNumberSafe(getRaw('operationSeq'))
  normalized.workOrderId = parseNumberSafe(getRaw('workOrderId'))
  normalized.hoursToGo = parseNumberSafe(getRaw('hoursToGo'))
  
  // Qty Released defaults to deliveryQty if not provided
  normalized.qtyReleased = parseNumberSafe(getRaw('qtyReleased')) ?? normalized.deliveryQty
  
  // Qty Completed defaults to cyclesToGo if not provided
  normalized.qtyCompleted = parseNumberSafe(getRaw('qtyCompleted')) ?? normalized.cyclesToGo
  
  // Date fields
  normalized.dueDate = parseDateSafe(getRaw('dueDate'))
  normalized.requestDate = parseDateSafe(getRaw('requestDate'))
  normalized.shipDate = parseDateSafe(getRaw('shipDate'))
  normalized.startTime = parseDateSafe(getRaw('startTime'))
  normalized.endTime = parseDateSafe(getRaw('endTime'))
  
  // Boolean fields
  normalized.firmFlag = parseBooleanSafe(getRaw('firmFlag'))
  
  return normalized
}

// ============================================================================
// ROW FILTERING
// ============================================================================

/**
 * Validate and filter a normalized row
 * Returns { valid: boolean, reasons: string[] }
 */
export function validateRow(row, rowNumber) {
  const reasons = []
  
  // Critical validations
  if (!row.job) {
    reasons.push(`Row ${rowNumber}: Missing Job`)
    return { valid: false, reasons }
  }
  
  if (!row.workCenter) {
    reasons.push(`Row ${rowNumber}: Missing WorkCenter`)
    return { valid: false, reasons }
  }
  
  if (row.operationSeq === null || row.operationSeq <= 0) {
    reasons.push(`Row ${rowNumber}: Invalid OperationSeq (${row.operationSeq})`)
    return { valid: false, reasons }
  }
  
  // Non-critical warnings (still valid)
  if (!row.dueDate) {
    reasons.push(`Row ${rowNumber}: Missing DueDate - job may not appear in KPIs`)
  }
  
  if (row.startTime && isNaN(row.startTime.getTime())) {
    reasons.push(`Row ${rowNumber}: Invalid StartTime - cleared`)
    row.startTime = null
  }
  
  if (row.endTime && isNaN(row.endTime.getTime())) {
    reasons.push(`Row ${rowNumber}: Invalid EndTime - cleared`)
    row.endTime = null
  }
  
  return { valid: true, reasons }
}

// ============================================================================
// NOTE: Deduplication removed - work orders can run for multiple sales orders
// ============================================================================

// ============================================================================
// MAIN NORMALIZATION PIPELINE
// ============================================================================

/**
 * Process CSV rows through full normalization pipeline
 * 
 * @param {Array} rawRows - Raw CSV rows
 * @param {Array} rawHeaders - Raw CSV headers
 * @param {Object} options - Reserved for future options
 * @returns {Object} - { normalizedRows, stats, warnings, errors }
 */
export function normalizeCsvRows(rawRows, rawHeaders, options = {}) {
  const stats = {
    rowsLoaded: rawRows.length,
    rowsKept: 0,
    rowsDropped: 0,
    dropReasons: {
      missingJob: 0,
      missingWorkCenter: 0,
      invalidOperationSeq: 0,
    }
  }
  
  const warnings = []
  const errors = []
  
  // Build header mapping
  const { lookup, reverseMap, normalizedHeaders, unknownColumns } = buildHeaderLookup(rawHeaders)
  
  // Check for required headers
  const requiredFields = ['job', 'workCenter', 'operationSeq']
  const missingRequired = requiredFields.filter(field => !reverseMap[field])
  
  if (missingRequired.length > 0) {
    missingRequired.forEach(field => {
      const aliases = HEADER_ALIASES[field] || []
      errors.push(`Missing required column for '${field}'. Accepted headers: ${aliases.join(', ')}`)
    })
    return { normalizedRows: [], stats, warnings, errors }
  }
  
  // Normalize and filter rows
  const normalized = []
  
  rawRows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2 // +2 for header row and 1-based indexing
    
    // Normalize
    const norm = normalizeRow(rawRow, reverseMap)
    
    // Validate
    const { valid, reasons } = validateRow(norm, rowNumber)
    
    if (valid) {
      normalized.push(norm)
      // Add non-critical warnings
      reasons.forEach(r => warnings.push(r))
    } else {
      stats.rowsDropped++
      // Track drop reasons
      reasons.forEach(r => {
        if (r.includes('Missing Job')) stats.dropReasons.missingJob++
        if (r.includes('Missing WorkCenter')) stats.dropReasons.missingWorkCenter++
        if (r.includes('Invalid OperationSeq')) stats.dropReasons.invalidOperationSeq++
        warnings.push(r)
      })
    }
  })
  
  // Keep all rows - work orders can run for multiple sales orders
  const finalRows = normalized
  stats.rowsKept = finalRows.length
  
  // Final validation
  if (finalRows.length === 0 && rawRows.length > 0) {
    errors.push('No valid rows remained after filtering. Check required fields: Job, WorkCenter, OperationSeq.')
  }
  
  return {
    normalizedRows: finalRows,
    stats,
    warnings,
    errors,
    recognizedColumns: Object.keys(reverseMap),
    unknownColumns,
    normalizedHeaders,
    headerMapping: reverseMap,
  }
}
