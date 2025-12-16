# ShadowOps Integration & Field Reference

This document explains the backend, database schema, API, and how frontend fields map and are used by the ShadowOps UI. Use this for demos, investor/customer presentations, and handoffs.

---

## Quick Overview
- CSV upload → backend (/api/upload-csv) → Postgres `jobs` table
- Frontend fetches `/api/jobs` and maps rows to existing `rawJobs` shape used by the UI
- Existing analytics (status, projected completion, alerts, run lists, load summary, timelines) are unchanged and operate on the mapped rows

---

## Run Steps (short)
1. Start Postgres:
   ```bash
   docker compose up -d
   ```
2. Start backend:
   ```bash
   cd server
   npm install
   cp .env.example .env   # optional, edit values if desired
   npm run dev
   ```
3. Start frontend:
   ```bash
   cd /workspaces/ShadowOps
   npm install
   npm run dev -- --host 0.0.0.0 --port 3000
   ```
4. Open `http://localhost:3000` and upload `SAMPLE_JOBS.csv`.

---

## Postgres Schema (`jobs` table)

Table: `jobs`

- `id` (SERIAL PRIMARY KEY)
  - Internal auto-increment id.

- `job` (TEXT UNIQUE NOT NULL)
  - Canonical job identifier (mapped to frontend `Job`). Required for upsert.
  - Example: `12345` or `JOB-2025-001`.

- `part` (TEXT)
  - Part number / SKU (frontend `Part`).
  - Example: `ABC-001`.

- `customer` (TEXT)
  - Customer name (frontend `Customer`).

- `work_center` (TEXT)
  - Work center / resource group (frontend `WorkCenter`).

- `start_date` (DATE)
  - Job start date. Stored as SQL DATE (YYYY-MM-DD). Frontend expects `StartDate` formatted as `YYYY-MM-DD`.

- `due_date` (DATE)
  - Job due date. Stored as SQL DATE (YYYY-MM-DD). Frontend expects `DueDate` formatted as `YYYY-MM-DD`.

- `qty_released` (NUMERIC)
  - Quantity released / scheduled (frontend `QtyReleased`). Numeric; decimals allowed.

- `qty_completed` (NUMERIC)
  - Quantity completed so far (frontend `QtyCompleted`).

- `source_file` (TEXT)
  - Name of uploaded CSV file.

- `created_at` (TIMESTAMP DEFAULT now())
  - Row creation timestamp.

- `updated_at` (TIMESTAMP DEFAULT now())
  - Row last update timestamp (automatically updated via trigger on updates).

Notes:
- `job` is the unique key used for upserts. If a row with the same `job` exists, the backend updates the existing row and sets `updated_at`.
- Dates are normalized server-side to SQL DATE. The frontend maps them back to `YYYY-MM-DD` strings.

---

## Backend API

Base path: `/api`

### GET /api/health
- Purpose: healthcheck
- Response: `{ "ok": true }`

### POST /api/upload-csv
- Purpose: ingest CSV and upsert rows into `jobs` table
- Accepts: `multipart/form-data` with field `file` (CSV file)
- CSV expected headers (ShadowOps standard):
  - `Job,Part,Customer,WorkCenter,StartDate,DueDate,QtyReleased,QtyCompleted`
- Processing:
  - Parse CSV rows with header support (Papaparse)
  - Minimal validation: `Job` required
  - Convert quantities to numbers (strip non-numeric chars)
  - Parse start/due dates (used to insert into `DATE` fields; invalid becomes `NULL`)
  - For each row: SELECT existing by `job`. If present → `UPDATE`; else → `INSERT`.
- Response shape:
```json
{ "ok": true, "inserted": 3, "updated": 7, "totalRows": 10 }
```

### GET /api/jobs
- Purpose: return all jobs in DB
- Returns rows ordered by `due_date` ascending (NULLs last)
- Response shape:
```json
{ "ok": true, "jobs": [ { "job": "12345", "part": "ABC-001", "customer": "ACME", "work_center": "W/C-10", "start_date": "2025-12-01", "due_date": "2025-12-10", "qty_released": "10000", "qty_completed": "4200", ... }, ... ] }
```

---

## Frontend field mapping and usage

The frontend continues to use the same analytics and enrichment functions. The backend simply provides rows which are mapped to the expected CSV keys.

Mapping from backend row → frontend `rawJobs` object:

- `job` -> `Job` (string)
- `part` -> `Part`
- `customer` -> `Customer`
- `work_center` -> `WorkCenter`
- `start_date` -> `StartDate` (YYYY-MM-DD string or `null`)
- `due_date` -> `DueDate` (YYYY-MM-DD string or `null`)
- `qty_released` -> `QtyReleased` (numeric string or number)
- `qty_completed` -> `QtyCompleted` (numeric string or number)

These mapped rows are stored in `rawJobs` and the app's existing `enrichJob()` logic computes derived fields (see next section).

---

## Derived fields (frontend calculations) — what they mean

These are computed by the frontend `App.jsx` helper functions. Keep these in the UI for demo logic clarity.

- `progress` (number | null)
  - Computed as `QtyCompleted / QtyReleased` (0..1). Returns `null` when QtyReleased is missing or zero.
  - Used for progress bar and percent display.

- `scheduleRatio` (number | null)
  - Fractional progress of time between `StartDate` and `DueDate` at the analysis date (asOfDate). `0` = start date, `1` = due date, `>1` = past due.

- `status` (string)
  - One of: `Late`, `At Risk`, `On Track`.
  - `Late` if analysis date > DueDate.
  - `At Risk` if `scheduleRatio - progress > 0.25` (schedule leads progress by >25%).
  - Else `On Track`.

- `projectedCompletionDate` (Date | null)
  - Projection based on completion rate so far (completed per elapsed day) projected to finish remaining qty. Returns null if not computable.

- `projectedStatus` (string)
  - Derived from `projectedCompletionDate` vs `due_date` with small buffers:
    - `Projected Late` if projected completion > due_date + 0.5 days
    - `Projected Early` if projected completion < due_date - 2 days
    - `On Pace` otherwise

- `priorityScore` (number)
  - Heuristic score for run list prioritization. Factors include `status`, `projectedStatus`, days to due, and progress.

These derived values drive the UI (status pills, progress bars, alerts, run lists, load summary, and timeline visualization).

---

## Alerts and Run List logic (brief)

- Alerts are generated from enriched jobs (frontend):
  - Critical alerts for `status === 'Late'`.
  - Warning alerts for `projectedStatus === 'Projected Late'` or `status === 'At Risk'`.
  - Alerts include job, work center, due date, and a short description.

- Run List groups jobs by `WorkCenter` and sorts by `priorityScore` descending.

- Load Summary aggregates counts per `WorkCenter` (late, projected late, at-risk) and computes a `loadScore` for ranking.

---

## Data quality & validation guidance (for demos)

- Required: `Job` field.
- Dates should be `YYYY-MM-DD` when possible. The backend attempts to parse common date strings; invalid dates will be stored as `NULL` and the frontend will treat them as missing.
- Quantity fields should be numeric; backend strips non-numeric characters before parsing.

---

## Example upload (curl)

```bash
curl -v -F "file=@SAMPLE_JOBS.csv" http://localhost:5050/api/upload-csv | jq .

curl -s http://localhost:5050/api/jobs | jq .
```

---

## Files of interest

- `docker-compose.yml` — starts Postgres with persistent volume
- `server/index.js` — backend API
- `server/db.js` — DB initialization
- `vite.config.js` — dev proxy to backend
- `src/App.jsx` — changed upload flow to POST to `/api/upload-csv` and map results

---

If you want, I can also:
- Add a short `README.md` section that embeds the key parts of this file for quick copy-paste in slides.
- Create a printable one-page cheat-sheet for presenters summarizing the field meanings and demo script.

File created: `docs/INTEGRATION.md`
