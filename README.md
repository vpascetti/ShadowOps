# ShadowOps

**Real-Time Manufacturing Intelligence for Your ERP**

[![Demo Ready](https://img.shields.io/badge/status-demo%20ready-brightgreen)]()
[![License](https://img.shields.io/badge/license-Proprietary-blue)]()

---

## 🚀 Quick Start (1 Command)

```bash
./start.sh
```

Then open **http://localhost:5173** in your browser.

**That's it!** You now have:
- ✅ PostgreSQL database running
- ✅ Backend API server on port 5050
- ✅ Frontend dashboard on port 5173
- ✅ Stub data from the canonical provider

**To stop everything:**
```bash
./stop.sh
```

---

## 📑 CSV Contract (v1.0)

ShadowOps treats the CSV upload as an API. The canonical contract is versioned and documented:

### Legacy Formats
- Human-readable schema: [docs/csv-schema-v1.md](docs/csv-schema-v1.md)
- Machine-readable schema: [docs/csv-schema-v1.json](docs/csv-schema-v1.json)
- Alias map for headers: [docs/csv-aliases-v1.json](docs/csv-aliases-v1.json)
- Sample data: [docs/sample-data/sample-shadowops-v1.csv](docs/sample-data/sample-shadowops-v1.csv)

### **NEW: ShadowOps Export Format (v1.0)**
- **📘 [CSV Contract v1.0 - ShadowOps Export](docs/CSV_CONTRACT_V1_SHADOWOPS.md)** ← **Start Here**
- Operation-level flat export (one row per Job + WorkCenter + OperationSeq)
- Robust header alias mapping (handles Crystal export variations)
- Automatic data quality enforcement
- Deduplication and filtering rules
- DueDate as canonical customer commitment date

**Key Features:**
- ✅ Flexible header recognition (30+ aliases)
- ✅ Auto-drop rows with missing critical fields
- ✅ No hard-coded root causes or accountability
- ✅ Detailed import summary with warnings
- ✅ Material shortage detection (only when data present)

Required headers: Job, WorkCenter, OperationSeq. Common header variations (e.g., `Work Center`, `EQNO`) are normalized automatically. If required columns are missing or dates are invalid, the upload is rejected with clear guidance in the UI.

---

## 📋 Manual Setup

If you prefer manual control:

```bash
# 1. Start database
docker-compose up -d

# 2. Install dependencies (workspace root)
npm install

# 3. Start backend (in one terminal)
cd apps/api
npm run dev

# 4. Start frontend (in another terminal)
cd apps/web
npm run dev
```

---

## 🎯 For Pilot Customers

**See [DEMO_GUIDE.md](./DEMO_GUIDE.md) for:**
- Complete demo script
- Feature highlights
- Common questions & answers
- Pricing and pilot program details

---

## What is ShadowOps?

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