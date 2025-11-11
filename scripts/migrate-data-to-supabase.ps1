# migrate-data-to-supabase.ps1
# Exports countries and counteragents from local PostgreSQL and imports to Supabase

Write-Host "=== Data Migration: Local PostgreSQL -> Supabase ===" -ForegroundColor Cyan

# Local database connection
$localHost = "localhost"
$localPort = "5432"
$localDb = "ICE_ERP"
$localUser = "postgres"
$localPassword = "fulebimojviT1985%"

# Supabase database connection (you'll need to provide the password)
$supabaseHost = "aws-0-eu-west-1.pooler.supabase.com"
$supabasePort = "5432"  # Direct connection for data import (not pooler)
$supabaseDb = "postgres"
$supabaseUser = "postgres.fojbzghphznbslqwurrm"
Write-Host "`nEnter Supabase database password:" -ForegroundColor Yellow
$supabasePassword = Read-Host -AsSecureString
$supabasePasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabasePassword))

# Create export directory
$exportDir = ".\data-export"
if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir | Out-Null
}

Write-Host "`n1. Exporting countries from local database..." -ForegroundColor Green

# Export countries
$env:PGPASSWORD = $localPassword
pg_dump -h $localHost -p $localPort -U $localUser -d $localDb `
    -t countries `
    --data-only `
    --column-inserts `
    --no-owner `
    --no-privileges `
    -f "$exportDir\countries.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Countries exported successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to export countries" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Exporting counteragents from local database..." -ForegroundColor Green

# Export counteragents
pg_dump -h $localHost -p $localPort -U $localUser -d $localDb `
    -t counteragents `
    --data-only `
    --column-inserts `
    --no-owner `
    --no-privileges `
    -f "$exportDir\counteragents.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Counteragents exported successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to export counteragents" -ForegroundColor Red
    exit 1
}

# Count records in export files
$countriesCount = (Get-Content "$exportDir\countries.sql" | Select-String "^INSERT INTO").Count
$counteragentsCount = (Get-Content "$exportDir\counteragents.sql" | Select-String "^INSERT INTO").Count

Write-Host "`n3. Export Summary:" -ForegroundColor Cyan
Write-Host "   - Countries: $countriesCount records"
Write-Host "   - Counteragents: $counteragentsCount records"

Write-Host "`n4. Importing to Supabase..." -ForegroundColor Green
Write-Host "   (This may take a few moments...)" -ForegroundColor Gray

# Import countries to Supabase
$env:PGPASSWORD = $supabasePasswordPlain
psql -h $supabaseHost -p $supabasePort -U $supabaseUser -d $supabaseDb `
    -f "$exportDir\countries.sql" `
    -v ON_ERROR_STOP=1 2>&1 | Out-String | Write-Host

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Countries imported successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to import countries (may already exist)" -ForegroundColor Yellow
}

# Import counteragents to Supabase
psql -h $supabaseHost -p $supabasePort -U $supabaseUser -d $supabaseDb `
    -f "$exportDir\counteragents.sql" `
    -v ON_ERROR_STOP=1 2>&1 | Out-String | Write-Host

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Counteragents imported successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to import counteragents (may already exist)" -ForegroundColor Yellow
}

Write-Host "`n5. Verifying data in Supabase..." -ForegroundColor Green

# Verify counts in Supabase
$verifyQuery = @"
SELECT 
    (SELECT COUNT(*) FROM countries) as countries_count,
    (SELECT COUNT(*) FROM counteragents) as counteragents_count;
"@

$verifyResult = $verifyQuery | psql -h $supabaseHost -p $supabasePort -U $supabaseUser -d $supabaseDb -t

Write-Host "`n✓ Migration Complete!" -ForegroundColor Green
Write-Host "Supabase now has:" -ForegroundColor Cyan
Write-Host $verifyResult

# Clean up password from environment
$env:PGPASSWORD = $null

Write-Host "`nExported files are in: $exportDir" -ForegroundColor Gray
Write-Host "You can delete this folder after verifying the migration." -ForegroundColor Gray
