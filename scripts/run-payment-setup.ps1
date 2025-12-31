#!/usr/bin/env pwsh
# Setup payment IDs with database selection

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'production')]
    [string]$Database = 'local'
)

$ErrorActionPreference = "Stop"

Write-Host "`n🎯 Payment ID Setup Script" -ForegroundColor Cyan
Write-Host "=" * 60

# Check current DATABASE_URL
$currentDbUrl = $env:DATABASE_URL
if (-not $currentDbUrl) {
    $currentDbUrl = (Get-Content .env.local -ErrorAction SilentlyContinue | Select-String '^DATABASE_URL=' | ForEach-Object { $_ -replace '^DATABASE_URL=', '' } | Select-Object -First 1)
}

if ($currentDbUrl -match 'localhost|127\.0\.0\.1') {
    $currentTarget = "LOCAL"
} else {
    $currentTarget = "PRODUCTION"
}

Write-Host "`nCurrent DATABASE_URL target: $currentTarget" -ForegroundColor Yellow

# Confirm before proceeding
Write-Host "`n⚠️  This script will:" -ForegroundColor Yellow
Write-Host "   1. Install trigger function (if missing)" -ForegroundColor Gray
Write-Host "   2. Backfill missing payment_id and record_uuid" -ForegroundColor Gray
Write-Host "   3. Verify payment #4226 has IDs" -ForegroundColor Gray

Write-Host "`n❓ Continue with $currentTarget database? (Y/N): " -ForegroundColor Cyan -NoNewline
$confirmation = Read-Host

if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "`n❌ Cancelled by user" -ForegroundColor Red
    
    Write-Host "`n💡 To run against production:" -ForegroundColor Yellow
    Write-Host "   1. Set DATABASE_URL to your Vercel/production database:" -ForegroundColor Gray
    Write-Host "      `$env:DATABASE_URL='your_production_connection_string'" -ForegroundColor Gray
    Write-Host "   2. Run this script again" -ForegroundColor Gray
    
    exit 0
}

Write-Host "`n🚀 Starting setup..." -ForegroundColor Green
Write-Host ""

try {
    node scripts/setup-payment-ids.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Setup completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Setup failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    exit 1
}
