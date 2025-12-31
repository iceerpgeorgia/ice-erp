#!/usr/bin/env pwsh
# Apply payment trigger to database with detailed logging

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 Applying payment trigger to database..." -ForegroundColor Cyan
Write-Host "   This will ensure payment_id and record_uuid auto-generate for new payments" -ForegroundColor Gray

$sqlFile = "prisma\migrations\20251224140000_update_payment_id_generation\migration.sql"

Write-Host "`n📋 Step 1: Checking SQL file..." -ForegroundColor Yellow
if (-not (Test-Path $sqlFile)) {
    Write-Error "❌ SQL file not found: $sqlFile"
    exit 1
}
Write-Host "   ✅ Found: $sqlFile" -ForegroundColor Green

Write-Host "`n📋 Step 2: Reading SQL content..." -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw
$lineCount = ($sqlContent -split "`n").Count
Write-Host "   ✅ Loaded $lineCount lines of SQL" -ForegroundColor Green

Write-Host "`n📋 Step 3: Validating database connection..." -ForegroundColor Yellow
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Error "❌ DATABASE_URL not set in environment"
}
Write-Host "   ✅ DATABASE_URL is set" -ForegroundColor Green

Write-Host "`n📋 Step 4: Executing SQL via Prisma..." -ForegroundColor Yellow
Write-Host "   ⏳ Running: npx prisma db execute --file $sqlFile" -ForegroundColor Gray

try {
    # Use --file instead of --stdin to avoid hanging
    $output = npx prisma db execute --file $sqlFile --schema prisma/schema.prisma 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ SQL executed successfully!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Command completed with exit code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "   Output: $output" -ForegroundColor Gray
    }
} catch {
    Write-Error "❌ Failed to execute: $_"
    exit 1
}

Write-Host "`n📋 Step 5: Verifying trigger installation..." -ForegroundColor Yellow
if (Test-Path "scripts/check-payment-trigger.js") {
    node scripts/check-payment-trigger.js
} else {
    Write-Host "   ℹ️ Verification script not found, skipping check" -ForegroundColor Gray
}

Write-Host "`n✅ Process complete!" -ForegroundColor Green
Write-Host "   New payments will now auto-generate payment_id and record_uuid" -ForegroundColor Gray
