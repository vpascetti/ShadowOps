# ShadowOps Backend (Local API Mode)

## Prerequisites
- Docker (for Postgres)
- Node.js 18+

## Setup & Run (Development)

1. **Start Postgres via Docker Compose**

```
docker compose up -d
```

2. **Configure environment variables**

- Copy `.env.example` to `.env` in `/server` and fill in secrets as needed.
- The default DB user/password is set for local dev.

3. **Install backend dependencies**

```
cd server
npm install
```

4. **Run the backend server**

```
npm run dev
```

- The server runs on port 5050 by default.

5. **Frontend setup**

- Copy `.env.example` to `.env` in the root and set `VITE_TENANT_TOKEN` (see below).
- Install frontend deps:

```
npm install
```

- Start Vite dev server:

```
npm run dev -- --host 0.0.0.0 --port 3000
```

## Tenant Token (Dev)
- On first backend startup, a demo tenant and token will be created if not present.
- The plaintext token will be printed to the backend console ONCE. Copy this value to your frontend `.env` as `VITE_TENANT_TOKEN`.

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/sync/status` — Ingest status for current tenant
- `GET /api/jobs` — List jobs (requires `x-tenant-token` header)
- `POST /api/ingest/jobs` — Bulk ingest jobs (requires `x-tenant-token` header)

## Example: Ingest Jobs via cURL

```
curl -X POST http://localhost:5050/api/ingest/jobs \
  -H "x-tenant-token: <YOUR_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      { "job_id": 1001, "job": "A1001", "work_center": "WC1", "start_date": "2025-01-01", "due_date": "2025-01-10", "qty_released": 100, "qty_completed": 20 },
      { "job_id": 1002, "job": "A1002", "work_center": "WC2", "start_date": "2025-01-02", "due_date": "2025-01-12", "qty_released": 200, "qty_completed": 50 }
    ]
  }'
```

- Replace `<YOUR_TOKEN_HERE>` with the token printed by the backend.

## Testing
- Ingest jobs as above, then reload the UI. The dashboard should show jobs from the API.

## Notes
- No Oracle connectivity in this phase.
- All data is local to your Codespace/dev environment.
