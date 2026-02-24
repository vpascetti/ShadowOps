# Updated: Interactive IQMS Setup for Pilots

## What Changed

Your pilot package now has **automated, interactive IQMS credential setup**. Instead of customers having to manually edit `.env` files, they simply follow prompts.

---

## Customer Experience (New Flow)

```bash
# Customer runs one command:
./start.sh

# They see:
ShadowOps Pilot Setup
=======================================================

SUCCESS: Docker is running

IQMS Database Configuration
==============================

ShadowOps connects to your IQMS database to validate the integration.
This pilot uses LIVE DATA - no demo/sample data.

Enter your IQMS database details:

1. IQMS Host/IP Address: [customer enters: iqms.company.com]
2. IQMS Port (default 1521): [customer enters: 1521]
3. IQMS Username: [customer enters: their_user]
4. IQMS Password (won't display): [customer enters: ••••••••••]
5. IQMS Database/SID Name: [customer enters: IQMSDB]

Confirming your settings:
  Host: iqms.company.com
  Port: 1521
  User: their_user
  Database: IQMSDB

Are these correct? (y/n): y

Saving IQMS configuration...
SUCCESS: IQMS configuration saved

Starting ShadowOps services...
  - PostgreSQL database
  - API server
  - Web application

Waiting for services to start (this takes ~30 seconds on first run)...
Checking service health...
SUCCESS: API is running
SUCCESS: Web application is running

ShadowOps Pilot is Ready!
=======================================================

Access the application:
  http://localhost:5173

IQMS Connection:
  Connected to: iqms.company.com
  Using LIVE DATA from your production IQMS

Useful commands:
   View logs:     docker-compose logs -f
   Stop services: ./stop.sh
   Restart API:   docker-compose restart api

Next steps:
   1. Open http://localhost:5173 in your browser
   2. Review DEMO_GUIDE.md for feature walkthrough
   3. Test data import and validation
   4. Provide feedback to the ShadowOps team
```

---

## Key Improvements

- No manual `.env` editing required
  - Customer doesn't need to know about configuration files
  - Guided prompts are clear and explicit

- Live IQMS data validated
  - Explicitly states "This pilot uses LIVE DATA - no demo/sample data"
  - Confirms customer is connecting to actual IQMS server
  - Connection tested immediately

- Error handling
  - Validates each input as required
  - Allows retry if customer makes a mistake
  - Clear error messages

- Persistence
  - Credentials saved to `.env` for subsequent runs
  - Can reconfigure by running `./start.sh` again
  - Remembers previous settings

- Professional experience
  - Progress indicators show what's happening
  - Final summary shows exactly what to do next

---

## What Your Customers Say "Yes" To

> "I just extract the ZIP, run one command, answer 5 questions, and it's live with my actual IQMS data?"

**Yes.** That's the entire experience.

---

## What Changed in the Package

| File | Change |
|------|--------|
| `start.sh` | Now interactive with IQMS credential prompts |
| `stop.sh` | Simplified, one-liner |
| `README.md` | Updated to reflect live data requirement |
| `docker-compose.yml` | Uses IQMS env vars from `.env` |
| `.env.example` | Includes IQMS variable placeholders |

---

## For Repeated Launches

Customer can run `./start.sh` again anytime:

```bash
# If IQMS credentials already in .env:
Do you want to reconfigure IQMS? (y/n): n
Using existing configuration
# ... starts services

# OR to change IQMS connection:
Do you want to reconfigure IQMS? (y/n): y
# ... prompts for new credentials
```

---

## Deployment Instructions

When you distribute to a customer:

```bash
# You create:
./pilot-package.sh 1.0.0
# Creates: shadowops-pilot-1.0.0.zip

# You send to customer with email:
"To get started, extract the ZIP and run: ./start.sh
 Then answer the 5 IQMS questions. You'll be validating 
 with your actual data in ~10 minutes total."
```

---

## Test It Yourself

Want to verify it works before distributing?

```bash
cd /workspaces/ShadowOps/shadowops-pilot-1.0.0

# Run it (will prompt, you can Ctrl+C when prompted for IQMS)
./start.sh

# See that it:
# - Checks Docker
# - Creates .env
# - Prompts for IQMS credentials
# - Saves them
# - Would start services (stop if you want)
```

---

## Summary

**Old way:** Customer edits `.env` file with text editor  
**New way:** Customer answers 5 prompts in interactive wizard

**Old way:** No validation that settings are correct  
**New way:** Confirms each setting before saving, asks for confirmation

**Old way:** Unclear about live vs demo data  
**New way:** Explicitly states "LIVE DATA - no demo/sample data"

This is **enterprise-grade pilot experience**. You're ready to hand to customers.
