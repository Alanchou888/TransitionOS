param(
  [switch]$Background,
  [switch]$SkipDb,
  [switch]$Dev
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

if (-not $SkipDb) {
  Step "Checking Docker service"
  $dockerService = Get-Service com.docker.service -ErrorAction SilentlyContinue
  if ($dockerService -and $dockerService.Status -ne "Running") {
    try {
      Start-Service com.docker.service -ErrorAction Stop
      Write-Host "Docker service started." -ForegroundColor Green
    } catch {
      Write-Warning "Could not start Docker service automatically. If needed, run PowerShell as Administrator or open Docker Desktop."
    }
  }

  Step "Waiting for Docker daemon"
  $ready = $false
  for ($i = 0; $i -lt 45; $i++) {
    docker version *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) {
    throw "Docker daemon is not ready. Please open Docker Desktop and rerun .\start-local.ps1."
  }

  Step "Starting PostgreSQL container"
  docker compose up -d db | Out-Host
  docker compose ps db | Out-Host
}

if (-not $Dev) {
  Step "Building app (stable mode)"
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed. Please rerun in an elevated PowerShell or use `.\start-local.ps1 -Dev`."
  }
}

$runScript = if ($Dev) { "dev" } else { "start" }
$logFile = if ($Dev) { "dev.log" } else { "start.log" }

if ($Background) {
  Step "Starting Next.js $runScript server in background"
  $command = "/c cd /d `"$repoRoot`" && npm.cmd run $runScript > $logFile 2>&1"
  Start-Process cmd.exe -ArgumentList $command | Out-Null
  Write-Host "Server started in background. Logs: $repoRoot\$logFile" -ForegroundColor Green
  Write-Host "Open: http://localhost:3000/login" -ForegroundColor Green
  exit 0
}

Step "Starting Next.js $runScript server"
npm.cmd run $runScript
