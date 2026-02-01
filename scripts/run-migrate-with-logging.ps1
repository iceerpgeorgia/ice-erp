$ErrorActionPreference = 'Stop'

$logPath = Join-Path $PSScriptRoot "migrate-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
Start-Transcript -Path $logPath -Append | Out-Null

$statusTimeoutSeconds = 60
$deployTimeoutSeconds = 900

function Write-Tail {
  param(
    [string]$Path,
    [int]$Lines = 20
  )
  if (Test-Path $Path) {
    Write-Host "----- tail $Lines lines: $Path -----"
    Get-Content -Path $Path -Tail $Lines | ForEach-Object { Write-Host $_ }
  }
}

function Run-CommandWithTimeout {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [int]$TimeoutSeconds,
    [string]$LogFileBase,
    [string]$WorkingDirectory
  )

  $stdoutLog = "$LogFileBase.out.log"
  $stderrLog = "$LogFileBase.err.log"
  Write-Host "[$(Get-Date -Format 'u')] Command: $Command $($Arguments -join ' ')"
  $proc = Start-Process -FilePath $Command -ArgumentList $Arguments -NoNewWindow -WorkingDirectory $WorkingDirectory -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
  $start = Get-Date
  while (-not $proc.HasExited) {
    $elapsed = (Get-Date) - $start
    if ($elapsed.TotalSeconds -ge $TimeoutSeconds) { break }
    Write-Host "[$(Get-Date -Format 'u')] Still running... elapsed: $elapsed"
    Write-Tail -Path $stdoutLog -Lines 10
    Write-Tail -Path $stderrLog -Lines 10
    Start-Sleep -Seconds 15
  }

  $completed = $proc.HasExited

  if (-not $completed) {
    Write-Host "[$(Get-Date -Format 'u')] WARNING: Command timed out after $TimeoutSeconds seconds"
    try { Stop-Process -Id $proc.Id -Force } catch {}
    Write-Tail -Path $stdoutLog -Lines 40
    Write-Tail -Path $stderrLog -Lines 40
    return $false
  }

  Write-Tail -Path $stdoutLog -Lines 40
  Write-Tail -Path $stderrLog -Lines 40
  if ($proc.ExitCode -ne 0) {
    throw "Command failed with exit code $($proc.ExitCode). See logs: $stdoutLog and $stderrLog"
  }
  return $true
}

try {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
  $envProdPath = Join-Path $repoRoot ".env.production"
  Write-Host "[$(Get-Date -Format 'u')] Loading DATABASE_URL from $envProdPath..."
  $raw = Get-Content -Raw $envProdPath
  $line = ($raw -split "`n" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
  if (-not $line) { throw "DATABASE_URL not found in .env.production" }

  $value = $line.Substring('DATABASE_URL='.Length).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Trim('"') }

  $directLine = ($raw -split "`n" | Where-Object { $_ -match '^DIRECT_DATABASE_URL=' } | Select-Object -First 1)
  if ($directLine) {
    $directValue = $directLine.Substring('DIRECT_DATABASE_URL='.Length).Trim()
    if ($directValue.StartsWith('"') -and $directValue.EndsWith('"')) { $directValue = $directValue.Trim('"') }
    $env:DATABASE_URL = $directValue
    Write-Host "[$(Get-Date -Format 'u')] Using DIRECT_DATABASE_URL for migrations."
  } else {
    $env:DATABASE_URL = $value
    Write-Host "[$(Get-Date -Format 'u')] Using DATABASE_URL for migrations."
  }

  $env:PRISMA_LOG_LEVEL = 'debug'
  $env:DEBUG = 'prisma:*'
  $env:RUST_LOG = 'info'
  $env:CHECKPOINT_DISABLE = '1'
  Write-Host "[$(Get-Date -Format 'u')] Prisma debug env set: PRISMA_LOG_LEVEL=$env:PRISMA_LOG_LEVEL, DEBUG=$env:DEBUG, RUST_LOG=$env:RUST_LOG"

  Write-Host "[$(Get-Date -Format 'u')] Parsing DATABASE_URL host/port..."
  try {
    $uri = [Uri]$env:DATABASE_URL
    Write-Host "[$(Get-Date -Format 'u')] DB Host: $($uri.Host)"
    Write-Host "[$(Get-Date -Format 'u')] DB Port: $($uri.Port)"
    Write-Host "[$(Get-Date -Format 'u')] Resolving DNS..."
    Resolve-DnsName -Name $uri.Host -ErrorAction Stop | Out-String | Write-Host
    Write-Host "[$(Get-Date -Format 'u')] Testing TCP connectivity..."
    Test-NetConnection -ComputerName $uri.Host -Port $uri.Port | Out-String | Write-Host
  } catch {
    Write-Host "[$(Get-Date -Format 'u')] WARNING: Unable to parse/test DATABASE_URL connectivity: $($_.Exception.Message)"
  }

  $schemaPath = (Join-Path $repoRoot "prisma\schema.prisma")
  Write-Host "[$(Get-Date -Format 'u')] Schema path: $schemaPath"
  Write-Host "[$(Get-Date -Format 'u')] Running prisma migrate status..."
  $statusStart = Get-Date
  $statusLogBase = Join-Path $PSScriptRoot "migrate-status-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  $statusOk = Run-CommandWithTimeout -Command "cmd.exe" -Arguments @('/c','npx','--yes','prisma','migrate','status','--schema', $schemaPath) -TimeoutSeconds $statusTimeoutSeconds -LogFileBase $statusLogBase -WorkingDirectory $repoRoot
  Write-Host "[$(Get-Date -Format 'u')] Status completed in $((Get-Date) - $statusStart)"
  if (-not $statusOk) {
    Write-Host "[$(Get-Date -Format 'u')] Proceeding to deploy despite status timeout."
  }

  Write-Host "[$(Get-Date -Format 'u')] Running prisma migrate deploy..."
  $deployStart = Get-Date
  $deployLogBase = Join-Path $PSScriptRoot "migrate-deploy-run-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Run-CommandWithTimeout -Command "cmd.exe" -Arguments @('/c','npx','--yes','prisma','migrate','deploy','--schema', $schemaPath) -TimeoutSeconds $deployTimeoutSeconds -LogFileBase $deployLogBase -WorkingDirectory $repoRoot | Out-Null
  Write-Host "[$(Get-Date -Format 'u')] Deploy completed in $((Get-Date) - $deployStart)"
} catch {
  Write-Host "[$(Get-Date -Format 'u')] ERROR: $($_.Exception.Message)"
  throw
} finally {
  Stop-Transcript | Out-Null
  Write-Host "[$(Get-Date -Format 'u')] Log saved to $logPath"
}
