# ShadowOps Roadmap

## Phase 1 — Backend + Postgres + Jobs API (Current Phase)
- Add docker-compose Postgres
- Add Node/Express backend
- Canonical table: `jobs`
- Endpoints:
  - `GET /api/health`
  - `GET /api/jobs`
  - `POST /api/upload-csv`
- Frontend: CSV upload → backend → jobs API → frontend state
- Vite proxy for `/api`

## Phase 2 — Snapshots + History (Time travel / trending)
- Add `snapshots` table and `snapshot_id` foreign key in jobs
- Endpoints:
  - `GET /api/snapshots`
  - `POST /api/snapshots`
  - `GET /api/jobs?snapshot_id=...`
- UI: Switch between snapshot dates

## Phase 3 — ODBC Connector (IQMS/DELMIAWorks first)
- Connector service/module for ODBC
- Endpoints:
  - `POST /api/connectors/odbc/test`
  - `POST /api/connectors/odbc/sync`
- Store connector config securely

## Phase 4 — Multi-tenant SaaS readiness
- Add `tenants` table
- Add authentication (sessions/JWT)
- Tenant scoping on all tables/endpoints
- Per-tenant connector configs

## Phase 5 — AI Copilot Layer (recommendations + explanations)
- AI runs server-side only
- Endpoint:
  - `POST /api/ai/briefing`
- Input: compact JSON summary
- Output: structured JSON (actions, risks, questions, assumptions)

---

## File/Folder Architecture Plan

- `/docker-compose.yml` — Postgres service
- `/server/` — Node/Express backend
  - `index.js` — API server
  - `db.js` — DB connection/init
  - `package.json` — backend deps/scripts
  - `.env.example` — backend env vars
- `/src/` — React frontend
  - `components/` — UI components
  - `App.jsx`, `main.jsx` — entry points
- `/vite.config.js` — Vite config with API proxy
- `/ROADMAP.md` — This roadmap

---

## Stubs/TODOs for Future Phases
- Add snapshot logic and endpoints (Phase 2)
- Add ODBC connector module and endpoints (Phase 3)
- Add multi-tenant/auth logic (Phase 4)
- Add AI Copilot endpoint and logic (Phase 5)
