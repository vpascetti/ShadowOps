# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

SHADOWOPS — PRODUCT SPECIFICATION (v1)
A universal optimization layer for manufacturing ERP systems
1. What ShadowOps Does
ShadowOps is a real-time, ERP-agnostic intelligence layer that sits above any existing ERP (IQMS, DELMIAWorks, Epicor, Plex, NetSuite, etc.) and delivers:
Core Capabilities
Real-Time Data Ingestion
Import shop floor, production, quality, downtime, and scheduling data using CSV, APIs, or direct connectors.
Live Plant Command Center
A modern, visual dashboard showing machine states, job progress, throughput, scrap, cycle times, WIP, and late-risk indicators.
ShadowPulse™ (Alert Engine)
Automated alerts for:
Late jobs
Scrap spikes
Cycle-time variance
Excess idle time
Material shortages
Quality/SPC failures
AI Decision Support
Root cause analysis (“Why is this job behind?”)
Prioritized actions (“Fix these 3 issues first”)
Predictive job completion times
Demand/schedule optimization suggestions
Automation Layer (v2+)
Generate ERP alerts automatically, fill missing data, reconcile lot movements, suggest corrective actions, and reduce manual admin.
2. Who ShadowOps Is For
ShadowOps is built for the people in the plant who are drowning in chaotic data, dated ERP screens, and slow decision loops.
Primary Users
Plant Managers → need real-time visibility and health of the entire plant
Schedulers / Planners → need clean, predictable forecasts and bottleneck alerts
Production Supervisors → need live job & machine statuses
Quality Managers → need scrap + SPC trends immediately
Maintenance Teams → need downtime visibility + predictive failure triggers
Secondary Users
Executives (CEO/COO)
Purchasing Managers (material shortages / supply risk)
CI Teams (Lean/Six Sigma)
ShadowOps is not a replacement for ERP — it is a force multiplier for all plant roles.
3. What Pain ShadowOps Solves
⚠️ The Reality in Most Plants
Manufacturers rely on aging ERPs that:
Don’t show real-time data
Require manual exports/imports
Have outdated interfaces
Don’t provide proactive guidance
Make supervisors reactive instead of strategic
Hide inefficiencies behind 20-click screens
Have inconsistent data accuracy
Plants lose MILLIONS in:
scrap,
late jobs,
changeover mistakes,
poor scheduling,
missing downtime reasons,
slow decision-making.
ShadowOps Eliminates These Problems
Dirty Data → Clean Data
Standardized ingestion, validation, error checking.
Static Reports → Real-Time Dashboards
You see problems as they form, not after.
Supervisor Guessing → AI Guidance
Root causes + prioritized fixes.
Inefficiency → Automation
Reduce manual IQMS/IQAlert admin.
Auto-generate rules, reconcile lots, solve repeat problems.
Scattered Info → Single Source of Truth
One place where all teams see plant health clearly.
4. v1 Features vs Future Versions
v1 (Prototype → Alpha)
These are the non-negotiable features that make ShadowOps usable and valuable from day one:
Data Ingestion
CSV ingestion pipeline
Data validation
Mappings for:
Work centers
Jobs
Production reporting
Downtime
Scrap
Dashboards
Live machine status
Job progress
Shift performance
Scrap metrics
Basic trends (cycle time, throughput)
Alerts (ShadowPulse v1)
Late job risk
Idle for too long
Scrap % spike
Cycle-time variance
Material missing / low
Quality hold moves
AI v1
“What’s causing this delay?”
“What do we fix first?”
Basic predictive completion time
Natural-language query on plant data
Admin
User authentication
Multi-tenant architecture (for future customers)
Dark mode UI
Role-based access
v2 (Beta → Launch)
IQMS direct connector (ODBC/API)
Connectors for Epicor, Plex, NetSuite, Acumatica
Predictive scheduling engine
Maintenance prediction
Work-in-progress optimization
Advanced scrap classification
Automatic ERP alert creation
Mobile app layout
Custom KPI builder
v3 (Scale → Enterprise)
Full Industrial IoT (PLC / OPC-UA) ingestion
AI Co-Pilot for manufacturing (chat + recommendations)
Workforce analytics
Supplier risk scoring
Autonomous scheduling
Prescriptive maintenance
ESG/GHG emissions dashboards
AI “virtual plant manager” (long-term optimization modeling)
5. Non-Negotiables for ShadowOps (v1 and beyond)
These define the soul of the product — the things that must always be true.
1. Real-Time Ingestion
If the plant changes, ShadowOps must reflect it within minutes.
2. Real-Time Alerting
No batch alerts. No dead dashboards.
ShadowOps pushes intelligence, not waits to be asked.
3. Universal ERP Compatibility
ShadowOps must integrate with ANY ERP.
This is your competitive advantage.
4. Zero-Friction Setup
If they can export a CSV → they can use ShadowOps.
5. Clean, Modern UI
ERP screens are ugly and slow.
ShadowOps must feel elite, fast, dark, and powerful.
6. Action Over Information
Dashboards tell you what is happening.
ShadowOps tells you what to do next.
6. High-Level Architecture Overview (v1)
Simple, scalable, and designed for multi-ERP integration.
Frontend (Next.js / React)
Real-time dashboards
Alerts feed
Login system
AI insights panel
Configuration pages
Backend (FastAPI)
REST API
Data models
Ingestion endpoints
Alerting logic
AI endpoints
Multi-tenant user management
Data Ingestion Layer
v1
CSV Parser
Validation rules
Scheduled ingestion
Mapping engine
v2
ERP connectors
SFTP automated drops
Direct DB queries
Webhooks
Processing Layer (ShadowPulse Engine)
Celery workers
Alert rules
Trend monitoring
Anomaly detection
Predictive modeling
Database (PostgreSQL)
Stores:
Jobs
Machines
Scrap
Downtime
Shifts
Alerts
Users
Tenants
Predictions
AI Layer
LLM query interface
Feature engineering pipelines
Predictive modeling (job completion, scrap risk, bottlenecks)
Root-cause analysis engine

---

## Demo Script & Integration Quickstart

Use this short script when demoing ShadowOps to customers or investors. It assumes you are running locally in the development container.

1. Start Postgres:

```bash
docker compose up -d
```

2. Start the backend server:

```bash
cd server
npm install
cp .env.example .env    # optional, edit if you want custom DB creds
npm run dev
```

3. Start the frontend:

```bash
cd /workspaces/ShadowOps
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

4. Open the app at `http://localhost:3000`.

5. Upload `SAMPLE_JOBS.csv` from the repo using the "Choose CSV File" button.

6. Verify:
- Jobs list populates and metrics update.
- Alerts show any late / at-risk jobs.
- The Run List groups jobs by `WorkCenter` and sorts by priority.

7. Refresh the page — data persists because it's saved to Postgres.

More details, field definitions, and API docs are in `docs/INTEGRATION.md`.