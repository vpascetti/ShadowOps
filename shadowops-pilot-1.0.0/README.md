# ShadowOps Pilot Setup Guide

## Overview

ShadowOps Pilot validates the integration with **your live IQMS database**. This is not a demo with sample data—it's a real integration test using your actual manufacturing data.

## Prerequisites

- **Docker Desktop** (includes Docker Engine and Docker Compose)
  - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Ensure Docker is running before starting

- **IQMS Database Access**
  - Host address (IP or hostname)
  - Port (usually 1521)
  - Username and password
  - Database/SID name

- **Minimum Requirements:**
  - 4GB RAM
  - 5GB free disk space
  - Internet connection
  - Network access to your IQMS database

## Quick Start (10 minutes)

### Step 1: Download & Extract
```bash
# Extract the pilot package
unzip shadowops-pilot-1.0.0.zip
cd shadowops
```

### Step 2: Run the Setup Script
```bash
# Start the interactive setup
./start.sh
```

**The script will:**
- Check Docker is running
- Prompt for your IQMS database credentials
- Save configuration securely
- Start all services (Database, API, Web)
- Validate everything is working

### Step 3: Access ShadowOps
Once the setup completes, open your browser to:
```
http://localhost:5173
```

**That's it!** You're now running ShadowOps with live IQMS data.

## Configuration

### Initial Setup
When you run `./start.sh`, you'll be prompted to enter your IQMS credentials:

```
IQMS Database Configuration
==============================

Enter your IQMS database details:

1. IQMS Host/IP Address: iqms.company.com
2. IQMS Port (default 1521): 1521
3. IQMS Username: your_user
4. IQMS Password: ••••••••••
5. IQMS Database/SID Name: IQMSDB
```

The script will validate and save these credentials to `.env`.

### Updating IQMS Configuration
To change IQMS credentials later:

```bash
# Run setup again - it will ask if you want to reconfigure
./start.sh

# OR manually edit .env and restart
nano .env
docker-compose restart api
```

### Manual Configuration (Advanced)
If you prefer to edit configuration manually:

```bash
# Edit the .env file
nano .env

# Update these fields:
IQMS_HOST=your-iqms-server
IQMS_PORT=1521
IQMS_USER=your-user
IQMS_PASSWORD=your-password
IQMS_DB=your-database

# Restart services
docker-compose restart api
```

## Viewing Logs

```bash
# All services
docker-compose -f docker-compose.pilot.yml logs -f

# Specific service
docker-compose -f docker-compose.pilot.yml logs -f api
docker-compose -f docker-compose.pilot.yml logs -f web
docker-compose -f docker-compose.pilot.yml logs -f db

# Exit log view
Ctrl+C
```

## Stopping Services

```bash
# Stop all services (data preserved)
docker-compose -f docker-compose.pilot.yml down

# Stop and remove all data
docker-compose -f docker-compose.pilot.yml down -v
```

## IQMS Integration (Automatic)

The pilot setup automatically connects to your IQMS database on first run. This is not optional—ShadowOps requires live IQMS data to validate the integration.

**What happens:**
1. Setup script prompts for IQMS credentials
2. Credentials are securely saved to `.env`
3. API service connects to your IQMS database
4. Web app displays data from your production IQMS

**The pilot validates:**
- ✅ Network connectivity to IQMS
- ✅ Database authentication
- ✅ Data import and mapping
- ✅ Real-time synchronization
- ✅ Dashboard accuracy with your data

**Your data safety:**
- No data is modified in IQMS (read-only connection)
- Credentials stored locally in `.env` (never transmitted)
- Data stays in your infrastructure
- All processing happens on your machine

## Troubleshooting

### "Docker is not running"
- Ensure Docker Desktop is started
- Check System Preferences/Settings

### "Port already in use"
Change ports in `.env`:
```env
API_PORT=8080      # Was 5050
WEB_PORT=8081      # Was 5173
DB_PORT=5433       # Was 5432
```

### "Database connection failed"
```bash
# Check database health
docker-compose -f docker-compose.pilot.yml logs db

# Restart database
docker-compose -f docker-compose.pilot.yml restart db
docker-compose -f docker-compose.pilot.yml restart api
```

### "Web app not loading"
```bash
# Check web service
docker-compose -f docker-compose.pilot.yml logs web

# Clear browser cache (Ctrl+Shift+Del)
```

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.pilot.yml logs -f`
- Review configuration in `.env`
- Contact: pilot-support@shadowops.com

## Next Steps

1. ✅ Access http://localhost:5173
2. ✅ Log in with default credentials (if configured)
3. ✅ Import your data via CSV or IQMS connection
4. ✅ Explore the dashboard and analytics
5. ✅ Provide feedback to the ShadowOps team
