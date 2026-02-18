// Shared helper: normalize root cause/accountable and detect material shortage
export function datasetHasShortageSignals(importStats, jobs = []) {
  if (importStats) {
    const cols = (importStats.recognizedColumns || []).map(String)
    const normalized = Array.isArray(importStats.normalizedHeaders)
      ? importStats.normalizedHeaders.map((h) => (typeof h === 'string' ? h : h.normalized || h.raw || '')).map(String)
      : []
    const candidates = ['MaterialShortage', 'Shortage', 'ShortageFlag', 'RootCause', 'Reason']
    const hasFromRecognized = candidates.some((c) => cols.includes(c))
    const hasFromNormalized = candidates
      .map((c) => c.toLowerCase().replace(/\s+/g, ' '))
      .some((c) => normalized.includes(c))
    if (hasFromRecognized || hasFromNormalized) return true
  }

  return Array.isArray(jobs)
    ? jobs.some((job) => Boolean(job?.MaterialShortage || job?.material_shortage || job?.material_exception || job?.MaterialShortQty))
    : false
}

function truthyFlag(val) {
  if (val === null || val === undefined) return false
  const s = String(val).trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'y' || s === 'yes' || s === 't'
}

export function getShortageInfo(job = {}, importStats) {
  const rawRoot = job.RootCause || job.root_cause || ''
  const rawAccountable = job.Accountable || job.accountable || ''
  
  // NEVER default to "Material Shortage" or "Procurement" - use blank/unknown instead
  const normalizedRootCause = rawRoot ? String(rawRoot) : ''
  const normalizedAccountable = rawAccountable ? String(rawAccountable) : ''

  const hasSignals = datasetHasShortageSignals(importStats, [job])
  const numericShort = Number(job.MaterialShortQty || job.material_short_qty || 0) > 0
  const explicitFlag =
    truthyFlag(
      job.MaterialShortage ||
        job.material_shortage ||
        job.material_exception ||
        job.Shortage ||
        job.ShortageFlag
    ) || numericShort
  const textFlag = /material/i.test(String(job.Reason || job.RootCause || job.reason || job.root_cause || ''))
  const userTagged = normalizedRootCause.toLowerCase().includes('material')
  const shortageFlag = !!(explicitFlag || textFlag || userTagged)

  return { normalizedRootCause, normalizedAccountable, shortageFlag, hasSignals }
}

