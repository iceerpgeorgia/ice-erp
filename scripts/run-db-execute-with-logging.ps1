param(
  [string]$SqlFile = "scripts/tmp-audit-check.sql",
  [string]$SchemaFile = "prisma/schema.prisma",
  [int]$TimeoutMinutes = 10
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutLog = Join-Path $logDir "db-execute-$timestamp.out.log"
$stderrLog = Join-Path $logDir "db-execute-$timestamp.err.log"
$transcript = Join-Path $logDir "db-execute-$timestamp.transcript.log"

$fullSql = (Resolve-Path (Join-Path $repoRoot $SqlFile)).Path
$fullSchema = (Resolve-Path (Join-Path $repoRoot $SchemaFile)).Path

Start-Transcript -Path $transcript | Out-Null

Write-Host "[db-execute] Repo root: $repoRoot"
Write-Host "[db-execute] SQL file:  $fullSql"
Write-Host "[db-execute] Schema:    $fullSchema"
Write-Host "[db-execute] Stdout:    $stdoutLog"
Write-Host "[db-execute] Stderr:    $stderrLog"
Write-Host "[db-execute] Timeout:   $TimeoutMinutes minute(s)"

if (-not (Test-Path $fullSql)) {
  throw "SQL file not found: $fullSql"
}
if (-not (Test-Path $fullSchema)) {
  throw "Schema file not found: $fullSchema"
}

Write-Host "[db-execute] Env: DATABASE_URL set = $([bool]$env:DATABASE_URL), DIRECT_DATABASE_URL set = $([bool]$env:DIRECT_DATABASE_URL)"

if (-not $env:DATABASE_URL -and -not $env:DIRECT_DATABASE_URL) {
  $envFile = Join-Path $repoRoot '.env.local'
  if (Test-Path $envFile) {
    Write-Host "[db-execute] Loading env from $envFile"
    Get-Content $envFile | ForEach-Object {
      $line = $_.Trim()
      if (-not $line -or $line.StartsWith('#')) { return }
      $idx = $line.IndexOf('=')
      if ($idx -lt 1) { return }
      $name = ($line.Substring(0, $idx) -replace "\0", "").Trim()
      if ([string]::IsNullOrWhiteSpace($name)) { return }
      $value = ($line.Substring($idx + 1)).Trim()
      if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      if (-not (Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue)) {
        Set-Item -Path "Env:$name" -Value $value
      }
    }
    Write-Host "[db-execute] Env after load: DATABASE_URL set = $([bool]$env:DATABASE_URL), DIRECT_DATABASE_URL set = $([bool]$env:DIRECT_DATABASE_URL)"
  }
}

if (-not $env:DATABASE_URL -and -not $env:DIRECT_DATABASE_URL) {
  throw "DATABASE_URL or DIRECT_DATABASE_URL must be set before running prisma db execute."
}

if ($env:DIRECT_DATABASE_URL) {
  Write-Host "[db-execute] Using DIRECT_DATABASE_URL for DATABASE_URL"
  $env:DATABASE_URL = $env:DIRECT_DATABASE_URL
}

# Optional connectivity checks if DIRECT_DATABASE_URL is set
if ($env:DIRECT_DATABASE_URL) {
  try {
    $uri = [Uri]$env:DIRECT_DATABASE_URL
    Write-Host "[db-execute] DIRECT_DATABASE_URL host: $($uri.Host) port: $($uri.Port)"
    $net = Test-NetConnection -ComputerName $uri.Host -Port $uri.Port -WarningAction SilentlyContinue
    Write-Host "[db-execute] TCP check: $($net.TcpTestSucceeded)"
  } catch {
    Write-Warning "[db-execute] Failed to parse DIRECT_DATABASE_URL: $($_.Exception.Message)"
  }
}

$cmd = "pnpm prisma db execute --schema `"$fullSchema`" --file `"$fullSql`""
Write-Host "[db-execute] Running: $cmd"

$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $cmd" -PassThru -NoNewWindow -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while (-not $process.HasExited) {
  if ((Get-Date) -gt $deadline) {
    Write-Warning "[db-execute] Timeout reached. Stopping process..."
    try { $process.Kill() } catch {}
    break
  }
  Start-Sleep -Seconds 5
  Write-Host "[db-execute] Still running... (PID: $($process.Id))"
  if (Test-Path $stdoutLog) {
    Write-Host "[db-execute] Last stdout lines:"
    Get-Content $stdoutLog -Tail 10 -ErrorAction SilentlyContinue
  }
  if (Test-Path $stderrLog) {
    Write-Host "[db-execute] Last stderr lines:"
    Get-Content $stderrLog -Tail 10 -ErrorAction SilentlyContinue
  }
}

Write-Host "[db-execute] Exit code: $($process.ExitCode)"

if (Test-Path $stdoutLog) {
  Write-Host "[db-execute] Final stdout tail:"
  Get-Content $stdoutLog -Tail 50 -ErrorAction SilentlyContinue
}
if (Test-Path $stderrLog) {
  Write-Host "[db-execute] Final stderr tail:"
  Get-Content $stderrLog -Tail 50 -ErrorAction SilentlyContinue
}

Stop-Transcript | Out-Null
