# ShadowOps Oracle Sync Runner

This tool syncs jobs from Oracle 19c into your local ShadowOps API.

## Setup

1. Copy `.env.example` to `.env` and fill in your Oracle and API credentials:

```
cp .env.example .env
```

- Set `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_SID` for your Oracle DB.
- Set `TENANT_TOKEN` to the value printed by the backend on first run (same as frontend `VITE_TENANT_TOKEN`).

2. Install dependencies:

```
npm install
```

## Run Once

```
npm run sync
```

- This will fetch jobs from Oracle and ingest them into ShadowOps via the API.

## Run Continuously (every 5 minutes)

```
npm run sync:watch
```

- This will run the sync every 5 minutes in a loop.
- Alternatively, use a scheduler (cron, systemd, etc.) to run `npm run sync` as needed.

## SQL Query
- The canonical Oracle job extractor is in `sql/jobs.sql`.
- Edit this file if you need to adjust the query for your schema.

## Troubleshooting
- If Oracle connect fails, check your `.env` and Oracle network/firewall.
- If ingest fails, check the API URL, token, and backend logs.

## API Contract
- This runner uses the existing `/api/ingest/jobs` endpoint. Do not change the backend contract.
