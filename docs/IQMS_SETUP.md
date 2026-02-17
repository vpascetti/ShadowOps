# IQMS Oracle Integration Setup Guide

**Status**: Oracle Instant Client installed and configured ✅  
**Next Step**: Set up SSH tunnel from local network

---

## Prerequisites (Completed)

- ✅ Oracle Instant Client 21.13 installed at `/opt/oracle/instantclient_21_13`
- ✅ TNS configuration created
- ✅ Environment variables configured in `apps/api/.env`
- ✅ IQMS credentials set (user: IQMS, password: iqms)

## IQMS Server Details

- **Host**: 10.149.25.189 (local network, not publicly accessible)
- **Port**: 1521
- **Service**: IQORA
- **Schema**: IQMS

## Network Architecture

```
Your Local Machine (10.149.25.189 accessible)
    ↓ SSH Tunnel
GitHub Codespace (localhost:1521)
    ↓ Oracle Client
apps/api → localhost:1521 → [tunnel] → 10.149.25.189:1521 → IQMS Oracle
```

---

## Setup Instructions (Run from LOCAL machine)

### Step 1: Install GitHub CLI (if needed)

**Windows**: Download from https://cli.github.com/  
**Mac**: `brew install gh`  
**Linux**: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

### Step 2: Authenticate

```bash
gh auth login
```

### Step 3: Create SSH Tunnel

```bash
# Replace 'organic-journey-x549j5xg9x76h6979' with your actual codespace name
gh codespace ssh --codespace organic-journey-x549j5xg9x76h6979 \
  -- -R 1521:10.149.25.189:1521 -o ServerAliveInterval=60 -N
```

**What this does:**
- Connects to your GitHub Codespace via SSH
- Creates a reverse tunnel: codespace localhost:1521 → your IQMS server
- Keeps connection alive every 60 seconds
- `-N` means "don't execute commands, just keep tunnel open"

**You should see:**
```
Tunnel established successfully
(Terminal stays open - do not close)
```

### Step 4: Test in Codespace

In the codespace terminal (or tell the assistant):

```bash
# Update .env to point to localhost
cd /workspaces/ShadowOps/apps/api
sed -i 's/IQMS_HOST=10.149.25.189/IQMS_HOST=localhost/' .env

# Set provider to IQMS
sed -i 's/DATA_PROVIDER=stub/DATA_PROVIDER=iqms/' .env

# Restart backend
pkill -f "tsx watch"
npm run dev
```

### Step 5: Verify Connection

```bash
curl http://localhost:5050/health
# Should show: "provider": "iqms"

curl http://localhost:5050/jobs | jq '.jobs | length'
# Should return number of jobs from IQMS
```

---

## Security Notes

✅ **Secure**: SSH tunnel uses encrypted connection  
✅ **Private**: Port 1521 only accessible within codespace  
✅ **Temporary**: Tunnel closes when you close terminal  
✅ **Authenticated**: Uses your GitHub credentials  

### Best Practices

1. **Use read-only credentials** if possible (all queries are SELECT)
2. **Keep tunnel visible** so you know when it's active
3. **Close when done**: Ctrl+C in the tunnel terminal
4. **Don't commit passwords**: `.env` is already in `.gitignore`

---

## SQL Queries (Ready to Use)

All queries are in `apps/api/sql/`:

- **iqms_jobs.sql** - List all active jobs with operations
- **iqms_job_detail.sql** - Detailed job view (filtered by :jobId)
- **iqms_operations.sql** - Operations/routing for a job
- **iqms_materials.sql** - Material requirements (BOM)
- **iqms_resources.sql** - Work center capacity and scheduled load

These can be customized to match your IQMS schema.

---

## Troubleshooting

### "Connection timed out"
- Tunnel not running or disconnected
- Restart tunnel on local machine

### "Invalid username/password"
- Check credentials in `apps/api/.env`
- Verify with IQMS admin

### "Table or view does not exist"
- IQMS schema may vary
- Review and adjust SQL queries in `apps/api/sql/`
- Check table names with: `SELECT * FROM USER_TABLES`

### "Cannot find libclntsh.so"
- Add to your shell profile (optional for persistence):
  ```bash
  export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_13:$LD_LIBRARY_PATH
  export TNS_ADMIN=/opt/oracle/instantclient_21_13/network/admin
  ```

---

## Codespace Name Reference

To find your codespace name:

```bash
# List your codespaces
gh codespace list

# Or from VS Code
# Look at bottom-left corner: "Codespaces: <name>"
```

Current codespace: `organic-journey-x549j5xg9x76h6979`

---

## Quick Reference

```bash
# Start tunnel (from LOCAL machine)
gh codespace ssh --codespace organic-journey-x549j5xg9x76h6979 -- -R 1521:10.149.25.189:1521 -N

# In codespace: switch to IQMS
cd /workspaces/ShadowOps/apps/api
echo "DATA_PROVIDER=iqms" >> .env
echo "IQMS_HOST=localhost" >> .env
npm run dev

# Test
curl http://localhost:5050/jobs | jq .

# Stop tunnel (from LOCAL machine)
Ctrl+C in tunnel terminal
```

---

**When Ready**: Just follow Step 3 to create the tunnel, then let the assistant know!
