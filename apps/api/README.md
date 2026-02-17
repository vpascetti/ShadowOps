# ShadowOps API

**Real-time manufacturing intelligence backend with ERP integration**

## Prerequisites
- Docker (for Postgres)
- Node.js 18+
- Oracle Instant Client (for IQMS integration - optional)

## Quick Start

From the workspace root, use the convenience script:

```bash
./start.sh
```

This starts Postgres, backend API (port 5050), and frontend (port 5173).

## Manual Setup

1. **Start Postgres via Docker Compose** (from workspace root)

```bash
docker compose up -d
```

2. **Configure environment variables**

```bash
cd apps/api
cp .env.example .env
# Edit .env as needed
```

3. **Install dependencies**

```bash
npm install
```

4. **Run the backend server**

```bash
npm run dev
```

Server runs on port 5050 by default.

## Data Providers

ShadowOps supports multiple data providers via the `DATA_PROVIDER` environment variable:

### Stub Provider (Default)
```bash
DATA_PROVIDER=stub
```
- Uses fixture data from `stubFixtures.json`
- Perfect for development and demos
- No external dependencies

### IQMS Provider (Oracle)
```bash
DATA_PROVIDER=iqms
IQMS_CONNECTOR=oracle
```
- Connects directly to IQMS Oracle database
- Requires Oracle Instant Client
- SQL queries in `sql/iqms_*.sql`
- See "IQMS Integration" section below

### Database Provider (Postgres)
```bash
DATA_PROVIDER=db
```
- Uses local Postgres database
- Accepts CSV imports via API
- Persistent storage

## IQMS Integration

### Prerequisites

1. **Oracle Instant Client**
   - Download from [Oracle Instant Client Downloads](https://www.oracle.com/database/technologies/instant-client/downloads.html)
   - Extract to a local directory (e.g., `/opt/oracle/instantclient_19_14`)

2. **Environment Variables**

```bash
# IQMS connection
IQMS_HOST=your-iqms-host
IQMS_PORT=1521
IQMS_SERVICE=IQORA
IQMS_USER=IQMS
IQMS_PASSWORD=your-password

# Oracle client paths
LD_LIBRARY_PATH=/opt/oracle/instantclient_19_14
TNS_ADMIN=/opt/oracle/instantclient_19_14/network/admin

# SQL file paths (default shown)
IQMS_SQL_JOBS_FILE=./sql/iqms_jobs.sql
IQMS_SQL_JOB_DETAIL_FILE=./sql/iqms_job_detail.sql
IQMS_SQL_OPERATIONS_FILE=./sql/iqms_operations.sql
IQMS_SQL_RESOURCES_FILE=./sql/iqms_resources.sql
IQMS_SQL_MATERIALS_FILE=./sql/iqms_materials.sql
```

### SQL Queries

The IQMS provider uses SQL queries in the `sql/` directory:

- **iqms_jobs.sql** - List all jobs with operations
- **iqms_job_detail.sql** - Detailed view for a specific job
- **iqms_operations.sql** - Operations/routing steps for a job
- **iqms_materials.sql** - Material requirements (BOM)
- **iqms_resources.sql** - Work center capacity and load

These queries can be customized to match your IQMS schema.

## API Endpoints

### Public Endpoints

- `GET /health` — Health check (returns provider type)

### Data Endpoints

- `GET /jobs` — List all jobs (with optional filters)
  - Query params: `status`, `dueDateStart`, `dueDateEnd`, `resourceId`
- `GET /jobs/:id` — Get detailed job information
  - Returns job details, operations, materials, resources
- `GET /metrics/summary` — Get dashboard metrics
  - Returns at-risk count, due next 7 days, overloaded resources

### CSV Import (Database Provider)

- `POST /upload-csv` — Import jobs from CSV
  - Accepts multipart/form-data with `file` field
  - Supports multiple CSV formats (legacy and ShadowOps v1)

## Testing

```bash
# Health check
curl http://localhost:5050/health

# Get all jobs
curl http://localhost:5050/jobs

# Get specific job
curl http://localhost:5050/jobs/JOB-1001

# Get metrics
curl http://localhost:5050/metrics/summary
```

## Development

The API uses TypeScript and can be run with hot-reload:

```bash
npm run dev     # Development with hot-reload
npm start       # Production mode
npm run seed    # Seed database with sample data
```
