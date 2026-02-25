$ErrorActionPreference = "Stop"

Write-Host "ShadowOps Installer" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

function Require-Value($label) {
  do {
    $value = Read-Host $label
  } while ([string]::IsNullOrWhiteSpace($value))
  return $value.Trim()
}

# Check Docker
try {
  docker info | Out-Null
} catch {
  Write-Host "Docker is not running or not installed. Please install Docker Desktop and try again." -ForegroundColor Red
  exit 1
}

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $installDir ".env"

# Collect IQMS / Oracle connection info
$iqmsHost = Require-Value "IQMS host (IP or DNS name)"
$iqmsPort = Read-Host "IQMS port [1521]"
if ([string]::IsNullOrWhiteSpace($iqmsPort)) { $iqmsPort = "1521" }
$iqmsService = Read-Host "IQMS service [IQORA]"
if ([string]::IsNullOrWhiteSpace($iqmsService)) { $iqmsService = "IQORA" }
$iqmsUser = Require-Value "IQMS username"
$iqmsPassword = Require-Value "IQMS password"

# Write .env for Docker Compose
$envLines = @(
  "PGHOST=db",
  "PGPORT=5432",
  "PGUSER=shadowops",
  "PGPASSWORD=shadowops_pass",
  "PGDATABASE=shadowops_db",
  "",
  "IQMS_HOST=$iqmsHost",
  "IQMS_PORT=$iqmsPort",
  "IQMS_SERVICE=$iqmsService",
  "IQMS_USER=$iqmsUser",
  "IQMS_PASSWORD=$iqmsPassword"
)

Set-Content -Path $envFile -Value $envLines -Encoding ASCII

Push-Location $installDir
try {
  Write-Host "Building and starting ShadowOps..." -ForegroundColor Cyan
  docker compose -f docker-compose.customer.yml up -d --build
} finally {
  Pop-Location
}

Write-Host "ShadowOps is starting. Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"
