# CSV Contract v1.0 - ShadowOps Export

## Overview

The ShadowOps Export format is a flat CSV where **one row = one operation** (Job + WorkCenter + OperationSeq). This document describes the canonical headers, normalization rules, and data quality enforcement.

## Canonical Headers

### Required Fields

| Canonical Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `job` | string | Job/Work Order identifier | "12345", "WO-2024-001" |
| `workCenter` | string | Work center code | "CNC-01", "MILL" |
| `operationSeq` | number | Operation sequence number (must be > 0) | 10, 20, 30 |

### Core Job Information

| Canonical Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `customer` | string \| null | Customer name | "Acme Corp" |
| `poNumber` | string \| null | Purchase order number | "PO-2024-123" |
| `itemNumber` | string \| null | Item/Part number | "PART-456" |
| `description` | string \| null | Part description | "Widget Assembly" |
| `deliveryQty` | number \| null | Quantity to deliver | 100 |
| `qtyReleased` | number \| null | Quantity released to shop floor | 120 |
| `qtyCompleted` | number \| null | Quantity completed | 45 |

### Date Fields

| Canonical Name | Type | Description | Notes |
|----------------|------|-------------|-------|
| `dueDate` | Date \| null | Customer commitment date | **Primary date for KPIs** (renamed from "Promise Date" in Crystal) |
| `requestDate` | Date \| null | Customer request date | |
| `shipDate` | Date \| null | Actual or planned ship date | |
| `startTime` | Date \| null | Operation start time | Can include time component |
| `endTime` | Date \| null | Operation end time | Can include time component |

### Schedule Fields

| Canonical Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `workOrderId` | number \| null | Numeric work order ID | 12345 |
| `schedColor` | string \| null | Schedule color code | "Green", "Red" |
| `firmFlag` | boolean \| null | Firm/frozen flag | true, false |
| `cyclesToGo` | number \| null | Remaining cycles | 50 |
| `hoursToGo` | number \| null | Remaining hours | 8.5 |

## Header Aliases

The normalizer recognizes multiple header variations. All matching is case-insensitive and ignores special characters.

### Job Aliases
- `Job`, `Order No.`, `ORDERNO`, `WO No.`, `Work Order No.`

### Customer Aliases
- `Customer`, `Customer ` (with trailing space), `@Customer Name`

### PO Number Aliases
- `PO Number`, `PONO`, `PONumber`

### Item Number Aliases
- `Item Number`, `ITEMNO`, `Mfg No.`, `Mfg No.:`, `ItemNumber`, `MfgNumber`

### Description Aliases
- `Description`, `DESCRIP`

### Delivery Quantity Aliases
- `Delivery Quantity`, `DeliveryQuantity`, `REL_QUAN`

### Qty Released Aliases
- `QtyReleased`, `Qty Released`, `RELEASED_QTY`
- **Default**: If not provided, uses `deliveryQty`

### Qty Completed Aliases
- `QtyCompleted`, `Qty Completed`, `COMPLETED_QTY`
- **Default**: If not provided, uses `cyclesToGo`

### Due Date Aliases (⚠️ Key Field)
- `DueDate`, `Promise Date`, `@PromiseDateOnly`

### Ship Date Aliases
- `Ship Date`, `@ShipDate`

### Request Date Aliases
- `Request Date`, `@RequestDateOnly`

### Work Center Aliases
- `WorkCenter`, `Work Center`, `EQNO`

### Operation Seq Aliases
- `OperationSeq`, `Seq`, `Seq:`, `CNTR_SEQ`, `CNTR_`

### Schedule Color Aliases
- `Sched Color`, `Sched Color:`, `@sched color`

### Firm Flag Aliases
- `Firm`, `Firm:`, `FirmFlag`

### Work Order ID Aliases
- `WorkOrderID`, `WORKORDER_ID`, `Work Order:`, `Work Order`

### Cycles To Go Aliases
- `CyclesToGo`, `Cycles To Go`, `CYCLES_TO_GO`

### Hours To Go Aliases
- `HoursToGo`, `Hrs To Go`, `Hrs To Go:`, `HOURS_TO_GO`

### Start Time Aliases
- `StartTime`, `Start Time`, `Start Time:`

### End Time Aliases
- `EndTime`, `End Time`, `End Time:`

## Normalization Rules

### Date Parsing
Supports multiple formats:
- ISO 8601: `2024-01-15`, `2024-01-15T10:30:00Z`
- US Format: `01/15/2024`, `1/15/2024`
- Dash Format: `01-15-2024`, `1-15-2024`

Invalid dates are set to `null` and logged as warnings.

### Number Parsing
- Strips commas: `"1,234"` → `1234`
- Handles blanks: `""` → `null`
- Invalid numbers: `"N/A"` → `null`

### Boolean Parsing
Accepts: `true`, `1`, `y`, `yes`, `t` (case-insensitive) → `true`  
Accepts: `false`, `0`, `n`, `no`, `f` (case-insensitive) → `false`  
All others → `null`

## Row Filtering (Critical)

Rows are **dropped** (not imported) if:

1. ❌ **Missing Job** - `job` field is null/empty after trimming
2. ❌ **Missing WorkCenter** - `workCenter` field is null/empty
3. ❌ **Invalid OperationSeq** - `operationSeq` is null or ≤ 0

Rows are **kept with warnings** if:
- `dueDate` is missing (job won't appear in late/at-risk KPIs)
- `startTime` or `endTime` are invalid (cleared to null)

## Deduplication

**Default**: ON (can be disabled via `dedupe=false` option)

### Unique Key
```
${workOrderId || job}__${workCenter}__${operationSeq}__${startTime || ""}__${endTime || ""}
```

- **First occurrence** is kept
- Duplicates are counted and logged

## KPI Logic

### Critical Rule: Use `dueDate`, NOT `shipDate`

- **Late**: `analysisDate > dueDate` (if dueDate exists)
- **Projected Late**: `endTime > dueDate` (if both exist)
- **At Risk**: `dueDate` within threshold (e.g., 7 days) AND `hoursToGo` high OR insufficient progress

### Root Cause & Accountability

⚠️ **NEVER** default to hard-coded values:
- ❌ Do NOT default `rootCause` to `"Material Shortage"`
- ❌ Do NOT default `accountable` to `"Procurement"`

✅ Use blank or empty string if not present in CSV.

## Material Shortage Detection

The system detects material shortages **only if**:
1. CSV contains explicit columns: `MaterialShortage`, `Shortage`, `ShortageFlag`, `RootCause`, or `Reason`
2. These columns have real values

If shortage signals are NOT present in CSV:
- Material Shortage panel shows: _"Material shortage signals not included in this snapshot"_
- Do NOT infer shortages from progress/schedule heuristics

## Import Summary

After each import, display:

| Metric | Description |
|--------|-------------|
| **Rows Loaded** | Total rows in CSV (including header) |
| **Rows Kept** | Valid rows after filtering |
| **Rows Dropped** | Invalid rows (broken down by reason) |
| **Duplicates Removed** | Count of duplicate operations |
| **Snapshot Timestamp** | From `SnapshotTS` column or upload time |

### Drop Reasons Breakdown
- Missing Job: X rows
- Missing WorkCenter: Y rows
- Invalid OperationSeq: Z rows

## Sample CSV

```csv
Job,Customer,Item Number,Work Center,OperationSeq,DueDate,Hrs To Go,Start Time,End Time
12345,Acme Corp,PART-001,CNC-01,10,2024-01-20,8.5,2024-01-15 08:00,2024-01-15 16:30
12345,Acme Corp,PART-001,ASSY-02,20,2024-01-20,4.0,2024-01-16 08:00,2024-01-16 12:00
67890,Widget Inc,PART-002,MILL,10,2024-01-25,16.0,2024-01-17 08:00,2024-01-18 16:00
```

## Error Handling

### Fatal Errors (Import Rejected)
- Missing required columns (Job, WorkCenter, OperationSeq)
- No valid rows after filtering

### Warnings (Import Succeeds)
- Rows dropped due to validation failures
- Missing optional columns
- Invalid date/number formats (field set to null)
- Duplicate rows detected

## Version History

- **v1.0** (2024-01-22): Initial ShadowOps Export format
  - Operation-level flat export
  - DueDate as canonical customer commitment
  - No hard-coded root causes
  - Explicit shortage signal detection

## Implementation Notes

### Backend: `shadowops_normalizer.js`
- Handles all header mapping and data coercion
- Enforces row-level validation
- Performs deduplication
- Returns detailed stats and warnings

### Frontend: `ImportSummaryPanel.jsx`
- Displays import metrics
- Shows drop reasons and warnings
- Expandable warnings list

### Shortage Detection: `shortage.js`
- Checks for explicit shortage columns
- Never defaults to "Material Shortage"
- Returns blank strings if data not present

---

**Last Updated**: 2024-01-22  
**Schema Version**: ShadowOps-1.0  
**Contact**: ShadowOps Development Team
