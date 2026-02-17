# ShadowOps CSV Schema v1.0

ShadowOps ingests production snapshots from CSV. This document defines the canonical contract for v1.0. The canonical headers are case-insensitive and may be provided via supported aliases (see `csv-aliases-v1.json`).

## Canonical Headers

**Required**
- Job
- Part
- Customer
- WorkCenter
- StartDate
- DueDate

**Optional (ingested when present)**
- QtyReleased
- QtyCompleted
- Progress
- Status
- Reason
- RootCause
- Accountable
- Projected
- Timeline

## Header Rules
- Case-insensitive; whitespace and punctuation are ignored for matching.
- Common aliases are accepted. Example: `Work Center`, `WC`, and `WorkCtr` all normalize to `WorkCenter`.
- Unknown columns are ignored during ingest but reported in validation output.
- Required columns must appear (using any accepted alias) or the upload is rejected.

## Date Formats
ShadowOps accepts these date formats:
- `YYYY-MM-DD`
- `MM/DD/YYYY`
- `MM-DD-YYYY`

Invalid or unparseable dates are reported as warnings and the affected rows are skipped.

## Sample (Valid) CSV Row
```
Job,Part,Customer,WorkCenter,StartDate,DueDate,QtyReleased,QtyCompleted,Status,Reason,RootCause,Accountable
100245,PN-9931,Acme Aerospace,CNC-01A1,2024-12-01,2024-12-10,120,45,At Risk,Material delay,Material Shortage,Procurement
```

## Aliases
See [`csv-aliases-v1.json`](./csv-aliases-v1.json) for the full alias list. Examples:
- WorkCenter: "Work Center", "Workcenter", "WC", "WorkCtr"
- Job: "WO", "Work Order", "Job No"
- StartDate: "Start", "Start Date", "Start Dt"
- DueDate: "Due", "Due Date", "Promise Date"

## Versioning
- Current version: **v1.0**
- Breaking changes will increment the major version (v2.0). Minor, backward-compatible updates will increment the minor version (v1.1, etc.).

## Downloadable Schema Assets
- Human-readable: `csv-schema-v1.md`
- Machine-readable: `csv-schema-v1.json`
- Alias map: `csv-aliases-v1.json`
