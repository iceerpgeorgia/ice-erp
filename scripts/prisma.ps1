<#!
.SYNOPSIS
  Thin wrapper to run the local Prisma CLI on Windows.

.USAGE
  # Step 6: Generate client
  #   .\scripts\prisma.ps1 generate

  # Step 7: Migrate (preferred)
  #   .\scripts\prisma.ps1 migrate dev --name add-soft-delete

  # Fallback: db push (DEV only)
  #   .\scripts\prisma.ps1 db push

  # Reset DB (DEV only, destructive)
  #   .\scripts\prisma.ps1 migrate reset
#>

param(
  [Parameter(Mandatory = $false, ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve repo root (one level up from this script)
$Repo = Resolve-Path (Join-Path $PSScriptRoot '..')

# Candidate Prisma shims under local node_modules/.bin
$Candidates = @(
  Join-Path $Repo 'node_modules/.bin/prisma.ps1'),
  (Join-Path $Repo 'node_modules/.bin/prisma.cmd'),
  (Join-Path $Repo 'node_modules/.bin/prisma')

$PrismaBin = $null
foreach ($c in $Candidates) {
  if (Test-Path $c) { $PrismaBin = $c; break }
}

if (-not $PrismaBin) {
  Write-Error "Local Prisma CLI not found under $($Repo)\node_modules\.bin. Run 'pnpm i' first."
}

# If we found the PowerShell shim, invoke it directly; otherwise invoke the cmd/unix shim.
if ($PrismaBin.ToLower().EndsWith('.ps1')) {
  & $PrismaBin @Args
} else {
  & $PrismaBin @Args
}

if ($LASTEXITCODE -ne $null) {
  exit $LASTEXITCODE
}
