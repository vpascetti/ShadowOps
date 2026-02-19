# ShadowOps Metrics Definition & Calculation Standards

**Document Version:** 1.0  
**Last Updated:** February 19, 2026  
**Status:** CRITICAL - All dashboards must use these definitions exclusively

---

## Overview

This document defines the authoritative calculations for all metrics displayed across ShadowOps dashboards. **Every metric must be calculated identically across all components and views.** This is non-negotiable for customer-facing data.

---

## Core Status Determination

### Job Status Classification (SINGLE SOURCE OF TRUTH)

**Located in:** `LegacyDashboard.tsx` → `determineStatus()` function

All jobs are classified into exactly ONE of these statuses:

#### **1. LATE** (Critical)
- **Condition:** Current date > Due Date (midnight-based comparison)
- **Calculation:**
  ```javascript
  const dueDate = parseDate(dueDateStr)  // Parse ISO date to midnight
  const asOfDateNormalized = new Date()  // Normalize to midnight
  asOfDateNormalized.setHours(0, 0, 0, 0)
  
  if (asOfDateNormalized.getTime() > dueDate.getTime()) {
    status = 'Late'
  }
  ```
- **Example:** Due date 2026-02-18, current date 2026-02-19 → LATE
- **Revenue Included:** ✅ YES - ALL revenue from late jobs counts toward "Late Revenue"

#### **2. AT RISK** (Warning)
- **Condition:** Schedule Ratio > Progress Ratio by >25%
- **Calculation:**
  ```javascript
  if (progress !== null && scheduleRatio !== null) {
    if (scheduleRatio - progress > 0.25) {
      status = 'At Risk'
    }
  }
  ```
- **Progress Ratio:** `QtyCompleted / QtyReleased`
- **Schedule Ratio:** `(Today - StartDate) / (DueDate - StartDate)`
- **Example:** 20% of time elapsed but only 10% complete → AT RISK (20% - 10% = 10% gap > 25% threshold = false, not at risk)
- **Revenue Included:** ✅ YES - ALL revenue from at-risk jobs counts toward "At Risk Revenue"

#### **3. ON TRACK** (Healthy)
- **Condition:** Not Late AND not At Risk
- **Revenue Included:** ✅ YES - ALL revenue from on-track jobs counts toward "Expected Revenue"

#### **4. PROJECTED LATE** (Information)
- **NOTE:** This is an informational flag, NOT a status that overrides the three statuses above
- **Used For:** Future trend analysis and early warnings
- **Revenue Treatment:** Jobs marked "Projected Late" are NOT moved to late revenue; they keep their current status revenue classification

---

## Order Value Calculation (SINGLE SOURCE OF TRUTH)

**Located in:** `LegacyDashboard.tsx` → `getJobOrderValue()` function

**Priority order:**

1. **If `total_order_value` exists and > 0:**
   ```javascript
   const direct = Number(job.total_order_value || job.TotalOrderValue || job.totalOrderValue)
   if (Number.isFinite(direct) && direct > 0) return direct
   ```

2. **Else if `unit_price` and `qty_released` both exist and > 0:**
   ```javascript
   const unitPrice = Number(job.unit_price || job.UnitPrice || job.unitPrice)
   const qty = Number(job.QtyReleased || job.qty_released || job.mfg_quantity || 0)
   if (Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(qty) && qty > 0) {
     return unitPrice * qty
   }
   ```

3. **Else:**
   ```javascript
   return 0
   ```

**Source of data:**
- `total_order_value`: Comes from IQMS backend via `/api/demo/jobs` endpoint (calculated as `ORD_DETAIL.UNIT_PRICE * PTALLOCATE.MFG_QUAN`)
- `unit_price`: Comes from IQMS `ORD_DETAIL.UNIT_PRICE`
- `qty_released`: Comes from IQMS `PTALLOCATE.MFG_QUAN` or job `MFG_QUANTITY`

**Never apply fallback logic** - if value is not available, it is 0.

---

## Critical Metrics Definitions

### Late Revenue (Executive Briefing)
- **Definition:** Sum of `getJobOrderValue()` for ALL jobs where `status === 'Late'`
- **Calculation:**
  ```javascript
  const lateRevenue = jobs
    .filter(job => job.status === 'Late')
    .reduce((sum, job) => sum + getJobOrderValue(job), 0)
  ```
- **Used In:** 
  - Executive Briefing → "Late Revenue" card
  - Plant-level breakdowns
  - Financial Summary
- **Display Format:** Currency (e.g., "$155,441,057")

### At Risk Revenue (Executive Briefing)
- **Definition:** Sum of `getJobOrderValue()` for ALL jobs where `status === 'At Risk'`
- **Calculation:**
  ```javascript
  const atRiskRevenue = jobs
    .filter(job => job.status === 'At Risk')
    .reduce((sum, job) => sum + getJobOrderValue(job), 0)
  ```
- **Used In:**
  - Executive Briefing → "At Risk Revenue" card
  - Risk analysis
- **Display Format:** Currency

### Expected Revenue (On-Time Revenue)
- **Definition:** Sum of `getJobOrderValue()` for ALL jobs where `status === 'On Track'`
- **Calculation:**
  ```javascript
  const expectedRevenue = jobs
    .filter(job => job.status === 'On Track')
    .reduce((sum, job) => sum + getJobOrderValue(job), 0)
  ```
- **Used In:**
  - Executive Briefing → "Expected Revenue" card
  - Financial forecasting
- **Display Format:** Currency

### Total Revenue at Risk
- **Definition:** Late Revenue + At Risk Revenue
- **Calculation:**
  ```javascript
  const totalRevenueAtRisk = lateRevenue + atRiskRevenue
  ```
- **Used In:**
  - Financial Summary
  - Executive summary views
- **Display Format:** Currency

### Late Job Count
- **Definition:** Count of ALL jobs where `status === 'Late'`
- **Calculation:**
  ```javascript
  const lateCount = jobs.filter(job => job.status === 'Late').length
  ```
- **Used In:**
  - Executive Briefing → "Late" card
  - All dashboards showing late job metrics
- **Display Format:** Integer

### At Risk Job Count
- **Definition:** Count of ALL jobs where `status === 'At Risk'`
- **Calculation:**
  ```javascript
  const atRiskCount = jobs.filter(job => job.status === 'At Risk').length
  ```
- **Used In:**
  - Executive Briefing → "At Risk" card
  - Risk analysis
- **Display Format:** Integer

---

## Plant/Work Center Breakdowns

### Late Revenue by Plant
- **Definition:** Sum of `getJobOrderValue()` for jobs where `status === 'Late'`, grouped by `getJobPlant(job)`
- **Grouping Key:** 
  ```javascript
  job.Plant || job.eplant_company || job.plant_name || job.eplant_id || job.plant_id || 'Unassigned'
  ```
- **Sorting:** By Late Job Count (descending), then by Late Revenue (descending)

### Late Jobs by Work Center
- **Definition:** Count of jobs where `status === 'Late'`, grouped by `job.WorkCenter`
- **Sorting:** By critical job count (descending)

---

## Database Source of Truth

All data originates from **real IQMS data only** - NO SYNTHETIC DATA:

| Metric | IQMS Table | Column | Backend Endpoint |
|--------|-----------|--------|------------------|
| Job ID | WORKORDER | WORKORDER_ID | `/api/demo/jobs` |
| Due Date | WORKORDER | PROMISE_DATE or MUST_SHIP_DATE | `/api/demo/jobs` |
| Unit Price | ORD_DETAIL | UNIT_PRICE | `/api/demo/jobs` (via `iqms_jobs_fast.sql`) |
| Quantity | PTALLOCATE | MFG_QUAN | `/api/demo/jobs` |
| Material Exceptions | XCPT_MAT_REQ | (joined table) | `/api/jobs/:jobId/materials` |

---

## Consistency Requirements

### ✅ MUST BE DONE
1. **All components must import metrics from centralized utility** (`apps/web/src/utils/metricsCalculations.ts`)
2. **Use `parseDate()` consistently** for all date comparisons
3. **Use `getJobOrderValue()` consistently** for ALL revenue calculations
4. **Use `getJobStatus()` consistently** for ALL status determinations
5. **Log metrics calculations** with debug console logs in production for audit trail
6. **Apply filters identically** across Executive Briefing, Operational Dashboard, Financial Summary

### ❌ MUST NOT BE DONE
1. **Copy-paste calculations** between components
2. **Hardcode thresholds** (e.g., 0.25 for at-risk gap) in components
3. **Use synthetic or fallback data** - if IQMS is unavailable, return error, not defaults
4. **Round or truncate values** in intermediate calculations
5. **Apply different date normalization** in different places
6. **Recalculate the same metric in multiple places**

---

## Testing & Validation

### Test Data
- **Late Jobs:** 117 as of 2026-02-19
- **Late Revenue:** $155,441,057
- **Projected On-Track:** 352 jobs
- **Expected Revenue:** ~$300M+ (for all on-track jobs)

### Verification Commands
```bash
# Verify backend data consistency
curl -s http://localhost:5050/api/demo/jobs | jq '{
  total: (.jobs | length), 
  late_count: ([.jobs[] | select(.due_date < "2026-02-19")] | length),
  late_revenue: ([.jobs[] | select(.due_date < "2026-02-19") | .total_order_value] | add)
}'

# Expected output:
# {
#   "total": 469,
#   "late_count": 118,
#   "late_revenue": 155441057.238
# }
```

---

## Audit Log

| Date | Change | Owner | Impact |
|------|--------|-------|--------|
| 2026-02-19 | Fixed `determineStatus()` to use proper date parsing instead of string comparison | GitHub Copilot | All late revenue calculations now accurate |
| 2026-02-19 | Added `material_exception` field to `/api/demo/jobs` response | GitHub Copilot | Material Status panel now populates correctly |
| 2026-02-19 | Created `/api/jobs/:jobId/materials` endpoint for material details | GitHub Copilot | Material breakdown now queries real IQMS data |
| 2026-02-19 | Removed all synthetic data from Executive Briefing and Plant Pulse | GitHub Copilot | Only real IQMS data displayed |

---

## Governance

**Review Frequency:** Before every customer-facing release  
**Approval Required:** @vpascetti  
**Change Request Template:** See CHANGE_LOG.md
