# Railway Deployment Guide

## Quick Start

ShadowOps can be deployed on Railway as **two separate services** (web + API) with shared PostgreSQL database.

## Prerequisites

1. **Railway account** (sign up at https://railway.app)
2. **GitHub repo connected** (fork or push ShadowOps to your GitHub)
3. **Demo password** (pick a strong one, e.g., `MySecure!Pass123`)

## Deployment Steps

### 1. Create PostgreSQL Database

1. Go to your Railway project
2. Click **+ Create**
3. Search for **Postgres**
4. Add new PostgreSQL service
5. Copy the connection string from the **Connect** tab

### 2. Deploy API Service

1. Click **+ Create → Repo → ShadowOps** (or your fork)
2. Railway will detect the Dockerfile.api
3. Go to **Variables** tab and set:
   - `DEMO_PASSWORD` = your chosen password
   - `DATABASE_URL` = the PostgreSQL connection string from above
   - `IQMS_ENABLED` = false (or set IQMS env vars if live data needed)
   - `PORT` = 5050
4. Go to **Deployments** and watch the build
5. Once deployed, copy the **Public Domain** (e.g., `https://yourdomain.railway.app`)

### 3. Deploy Web Service

1. Click **+ Create → Repo → ShadowOps**
2. Railway will detect Dockerfile.web
3. Go to **Variables** tab and set:
   - `VITE_DEMO_PASSWORD_REQUIRED` = true
   - `VITE_API_URL` = the Public Domain from API service (e.g., `https://api-yourdomain.railway.app`)
   - `PORT` = 3000
4. Go to **Deployments** and watch the build
5. Once deployed, copy the **Public Domain**

### 4. Test Access

1. Open the web service domain in your browser
2. You should see a password prompt
3. Enter your demo password
4. Executive Briefing and other dashboards should load

## Environment Variables Reference

### API Service
| Variable | Example | Notes |
|----------|---------|-------|
| `DEMO_PASSWORD` | `MySecure!Pass123` | REQUIRED for password gate |
| `DATABASE_URL` | `postgres://user:pass@host/db` | PostgreSQL connection string |
| `PORT` | `5050` | Listen port |
| `IQMS_USER` | (optional) | For live IQMS data |
| `IQMS_PASSWORD` | (optional) | For live IQMS data |
| `IQMS_HOST` | (optional) | For live IQMS data |
| `IQMS_PORT` | `1521` | (optional) Oracle port |

### Web Service
| Variable | Example | Notes |
|----------|---------|-------|
| `VITE_DEMO_PASSWORD_REQUIRED` | `true` | Show password gate |
| `VITE_API_URL` | `https://api-yourdomain.railway.app` | REQUIRED for separate services |
| `PORT` | `3000` | Listen port |

## Accessing the Demo

Once both services are live:

1. Open the **web service domain** in your browser
2. Enter the shared demo password
3. Explore Executive Briefing, Financial Summary, Plant Pulse, etc.

## Access from Multiple Devices

The public URL works on **any device** with internet access:
- Desktop browsers
- Mobile browsers
- Tablets
- Across different networks / offices

Just share the web service domain + demo password with your team.

## Troubleshooting

### "Unauthorized" errors
- Check `DEMO_PASSWORD` is set on **both** API and Web services
- Verify password is spelled correctly

### API call failures
- Check `VITE_API_URL` on web service points to the API service domain
- Verify API service is deployed and healthy (check logs)

### Database errors
- Confirm `DATABASE_URL` is correct on API service
- Check PostgreSQL service is running

### Missing data
- If IQMS not configured, you'll see demo/cached data only
- Set `IQMS_*` vars on API service to enable live data (requires SSH tunnel)

## Local Testing Before Deployment

Test locally first with:
```bash
npm run build:api && npm run build:web
PORT=3000 VITE_API_URL=http://localhost:5050 VITE_DEMO_PASSWORD_REQUIRED=true npm run start:web &
npm run start:api
```

Then visit `http://localhost:3000`.
