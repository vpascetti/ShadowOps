# Shipment-Based On-Time Revenue Implementation

## Overview
Fixed a critical issue where on-time revenue was calculated based on **job completion status** instead of **actual shipment performance**. This caused inaccurate financial reporting because a job can be complete but shipped late.

## The Problem
**Previous Logic** (INCORRECT):
```
on_time_revenue = jobs where (current_date <= due_date) AND (job status is complete)
```

**Issue**: Job 636400 was marked complete in IQMS, but the shipment of 200,000 pieces shipped LATE. The system still counted this as on-time revenue because the job was done.

## The Solution
**New Logic** (CORRECT):
```
on_time_revenue = shipments where (actual_ship_date <= promised_date)
late_revenue = shipments where (actual_ship_date > promised_date)
```

This uses the SHIPMENTS table which tracks:
- `actual_ship_date` → When the order actually shipped (from packing slip/invoice)
- `promised_date` → The original promised delivery date
- `qty_shipped` → Quantity shipped
- `total_order_value` → Revenue associated with the shipment

## Changes Made

### 1. Added Function to shipping-service.js
**Function**: `getOnTimeRevenueFromShipments(tenantId)`

Location: [apps/api/shipping-service.js](apps/api/shipping-service.js)

**What it does**:
- Queries SHIPMENTS table with status: `actual_ship_date <= promised_date` = "On Time"
- Sums revenue from both on-time and late shipments
- Returns comprehensive metrics:
  - `on_time_revenue` → Total revenue for on-time shipments
  - `late_revenue` → Total revenue for late shipments
  - `total_shipped_revenue` → Combined revenue
  - `on_time_shipments` → Count of on-time shipments
  - `late_shipments` → Count of late shipments
  - `on_time_percent` → Percentage of revenue that came from on-time shipments

### 2. New API Endpoint
**Endpoint**: `GET /api/shipping/on-time-revenue`

Location: [apps/api/index.js](apps/api/index.js) (lines ~1352-1363)

**Response Format**:
```json
{
  "ok": true,
  "metrics": {
    "on_time_revenue": 1234567.89,
    "late_revenue": 456789.12,
    "total_shipped_revenue": 1691357.01,
    "on_time_shipments": 145,
    "late_shipments": 23,
    "total_shipments": 168,
    "on_time_percent": 73.0,
    "metric_type": "shipment_based"
  },
  "explanation": "On-time revenue calculated from SHIPMENTS table (actual_ship_date vs promised_date)..."
}
```

## Database Schema
The calculation relies on the SHIPMENTS table having these columns:

```sql
-- Core shipment data
job_id              -- Links to jobs table
actual_ship_date    -- When order actually shipped
promised_date       -- Original promised delivery date
qty_shipped         -- Quantity shipped

-- Revenue calculation
total_order_value   -- Total order value (preferred)
unit_price          -- Unit price (fallback if total_order_value not available)
qty_shipped         -- Quantity to multiply with unit_price if needed

-- Optional tracking
delivery_status     -- "On Time" / "Late" / "Not Shipped"
days_late_or_early  -- How many days early/late
```

## Business Logic
The key insight user provided:
> "Just because a job is done doesn't mean it shipped on time. We should always look to the packing slip for on-time revenue."

**Decision Rules**:
- ✅ Job marked "Complete" in IQMS, shipped on-time → **ON-TIME REVENUE**
- ❌ Job marked "Complete" in IQMS, shipped late → **LATE REVENUE** (NOT on-time)
- ✅ Job still running, but shipped sample early → **ON-TIME REVENUE** (if promised date passed)
- ❌ Job archived, shipment never happened → **NOT COUNTED**

## Test Case
The issue was triggered with:
- **Job ID**: 636400
- **Qty**: 200,000 pieces
- **Status**: Archived/Complete in IQMS
- **Issue**: Shipment was late, but system counted it as on-time

**Expected After Fix**:
- Job 636400 should appear in SHIPMENTS table
- If shipment date > promise date → Should be counted in `late_revenue`
- If shipment date ≤ promise date → Should be counted in `on_time_revenue`

## Integration Points

### Frontend Usage (Recommended Updates)
1. **Executive Briefing** - Replace job-completion-based metric with shipment data
2. **Financial Summary** - Show breakdown of on-time vs late revenue
3. **Shipping Dashboard** - Display on-time delivery percentage by shipment

### API Calls Available
```bash
# Get shipment-based on-time revenue (NEW)
curl http://localhost:5050/api/shipping/on-time-revenue

# Get general shipping metrics (existing, lower priority now)
curl http://localhost:5050/api/shipping/metrics

# Get late shipments detail (existing, complements new metric)
curl http://localhost:5050/api/shipping/late?daysBack=30
```

## Files Modified
1. **apps/api/shipping-service.js** - Added `getOnTimeRevenueFromShipments()` function
2. **apps/api/index.js** - Added import and new endpoint `/api/shipping/on-time-revenue`

## Status
- ✅ Function implemented
- ✅ API endpoint created and tested
- ✅ Returns correct response format (currently 0 values due to no sample shipment data)
- ⏳ Pending: Frontend integration to use new metric
- ⏳ Pending: Verify with job 636400 shipment data once available

## Next Steps
1. Populate SHIPMENTS table with real or test data for job 636400
2. Update Executive Briefing to call `/api/shipping/on-time-revenue` instead of job-completion logic
3. Update Financial Summary to show on-time vs late revenue breakdown
4. Create dashboard widget for on-time delivery KPI tracking
