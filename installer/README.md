# ShadowOps Pilot Installer (Windows)

## Prerequisites
- Windows 10/11 or Windows Server 2019+
- Docker Desktop installed and running

## Install
1. Unzip the package.
2. Double-click install.cmd (or run install.ps1 in PowerShell).
3. Enter your IQMS (IQORA) connection details when prompted.
4. The installer will start ShadowOps and open the browser.

## Ports
- Web: http://localhost:5173
- API: http://localhost:5050

## Stop/Start
From the installer folder:
- Stop: `docker compose -f docker-compose.customer.yml down`
- Start: `docker compose -f docker-compose.customer.yml up -d`
