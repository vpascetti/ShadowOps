# ShadowOps Demo Setup Guide

## ⚡ Quick Reference: Where to Run Commands

| Command | Location | Purpose |
|---------|----------|---------|
| SSH Tunnel | **Windows PowerShell/CMD** (your local machine) | Connect Codespace to IQMS database |
| `./demo-start.sh` | **Codespaces Terminal** (browser) | Start API + Web app |
| `./demo-stop.sh` | **Codespaces Terminal** (browser) | Stop all services |

---

## 🚀 Demo Setup (Step by Step)

### Before You Start
- Have **2 terminal windows open side-by-side:**
  - Terminal 1: Windows PowerShell/CMD on your local machine
  - Terminal 2: Codespaces browser terminal

### Step 1: Start SSH Tunnel (Windows - Terminal 1)

Open **Windows PowerShell or Command Prompt** on your local machine and run:

```powershell
gh codespace ssh --codespace organic-journey-x549j5xg9x76h6979 -- -R 1521:localhost:1521 -o ServerAliveInterval=60 -N
```

**Keep this window open during the entire demo!** This creates the connection tunnel from Codespace to your IQMS database.

You should see output like:
```
Forwarding...
```

### Step 2: Start ShadowOps Services (Codespaces - Terminal 2)

In your **Codespaces browser terminal**, from the repository root, run:

```bash
./demo-start.sh
```

This will:
- ✅ Install dependencies (if needed)
- ✅ Start API server on `http://localhost:5050`
- ✅ Start Web app on `http://localhost:5173`
- ✅ Show setup status and instructions

Output will show:
```
✅ API running on http://localhost:5050
✅ Web app running on http://localhost:5173
```

### Step 3: Open Dashboard in Browser

Navigate to:
```
http://localhost:5173
```

You should see:
- 17 live jobs from IQMS
- Risk-ranked status indicators
- Operational dashboard with all data

---

## 📋 Stopping Services

### When Demo is Done:

**Terminal 2 (Codespaces):** Stop services
```bash
./demo-stop.sh
```
Or simply press `Ctrl+C`

**Terminal 1 (Windows):** Close SSH tunnel
Press `Ctrl+C` to close the PowerShell window

---

## 🔍 What Each Command Does

### SSH Tunnel (Windows)
```powershell
gh codespace ssh --codespace organic-journey-x549j5xg9x76h6979 -- -R 1521:localhost:1521 -o ServerAliveInterval=60 -N
```
- Forwards port 1521 from Codespace to your local IQMS database
- `-R 1521:localhost:1521` = reverse tunnel on port 1521
- `-o ServerAliveInterval=60` = keeps connection alive
- `-N` = no shell (just tunnel)

**Critical**: If this closes, data won't load! Keep it open.

### Demo Start (Codespaces)
```bash
./demo-start.sh
```
- Installs npm dependencies if needed
- Starts API server (port 5050)
- Starts web app (port 5173)
- Logs to: `api.log` and `web.log`

### Demo Stop (Codespaces)
```bash
./demo-stop.sh
```
- Gracefully stops API and web app
- Cleans up Node processes

---

## Services

| Service | URL | Port |
|---------|-----|------|
| Web Dashboard | http://localhost:5173 | 5173 |
| API | http://localhost:5050 | 5050 |
| API Health Check | http://localhost:5050/health | 5050 |
| IQMS Database | localhost (via SSH tunnel) | 1521 |

---

## 📊 Demo Flow Suggestions

1. **Show Job Dashboard**: Highlight 17 jobs with real-time risk scoring
2. **Filter by Status**: Switch between "On Track" and at-risk jobs
3. **Frozen Date Mode**: Demonstrate analyzing jobs at different dates
4. **Work Centers**: Show capacity overloads and queue depths
5. **Material Details**: Highlight jobs with shortage exceptions
6. **Risk Metrics**: Explain the 3-factor risk model

---

## 🐛 Troubleshooting

### API not connecting to IQMS?
- Verify SSH tunnel is running and showing "Forwarding"
- Check API logs: `tail -f api.log` (look for connection errors)
- Try restarting tunnel on Windows

### Web app not loading?
- Clear browser cache (Ctrl+Shift+Delete)
- Check web logs: `tail -f web.log`
- Verify port 5173 is accessible

### Services won't start?
- Make sure ports 5050 and 5173 are not in use
- Run `./demo-stop.sh` to clean up lingering processes
- Check available disk space

### Tunnel keeps disconnecting?
- Run tunnel in a cmd window (not PowerShell ISE)
- Check your firewall isn't blocking port 1521
- Verify IQMS server is still reachable

---

## Notes

- ✅ All data is **live from IQMS** (no CSV upload needed)
- ✅ Dashboard updates in real-time
- ✅ SSH tunnel is required for data to load
- ✅ Database connection is read-only (safe for demos)
- ✅ Both commands (`Ctrl+C`) will gracefully shut things down

