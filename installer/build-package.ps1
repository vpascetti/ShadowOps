$ErrorActionPreference = "Stop"

Write-Host "ShadowOps Package Builder" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $PSScriptRoot "dist"
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$packageName = "shadowops-pilot-$timestamp.zip"
$stagingDir = Join-Path $distDir "shadowops-pilot-$timestamp"

if (Test-Path $stagingDir) {
  Remove-Item -Recurse -Force $stagingDir
}

if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

Write-Host "Staging files..." -ForegroundColor Cyan

$excludeDirs = @(
  ".git",
  "node_modules",
  "apps\\web\\node_modules",
  "apps\\api\\node_modules",
  "packages\\adapters\\node_modules",
  "packages\\core\\node_modules",
  "installer\\dist",
  "shadowops-pilot-1.0.0",
  "shadowops-pilot-1.0.0.zip",
  "shadowops-pilot-1.0.0.tar.gz"
)

$robocopyArgs = @(
  $repoRoot,
  $stagingDir,
  "/E",
  "/XD"
) + $excludeDirs

$null = & robocopy @robocopyArgs

Write-Host "Creating zip: $packageName" -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath (Join-Path $distDir $packageName) -Force

Write-Host "Package ready: $distDir\$packageName" -ForegroundColor Green
Write-Host "Send this zip to pilot customers." -ForegroundColor Green
