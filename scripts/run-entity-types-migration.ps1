# Entity Types Migration Script
# Run this after setting SUPABASE_DATABASE_URL environment variable

Write-Host "`n=== Entity Types Migration Setup ===`n" -ForegroundColor Cyan

# Check if SUPABASE_DATABASE_URL is set
if (-not $env:SUPABASE_DATABASE_URL) {
    Write-Host "⚠️  SUPABASE_DATABASE_URL not found!" -ForegroundColor Yellow
    Write-Host "`nPlease set it first:" -ForegroundColor White
    Write-Host '  $env:SUPABASE_DATABASE_URL = "postgresql://postgres.PROJECT:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"' -ForegroundColor Gray
    Write-Host "`nOr get it from Vercel:" -ForegroundColor White
    Write-Host "  https://vercel.com/iceerpgeorgias-projects/ice-erp/settings/environment-variables" -ForegroundColor Gray
    Write-Host "`nThen run this script again.`n" -ForegroundColor White
    exit 1
}

Write-Host "✅ SUPABASE_DATABASE_URL is set" -ForegroundColor Green
Write-Host "`nRunning migration...`n" -ForegroundColor Cyan

# Run the migration
node scripts/migrate-entity-types.js

Write-Host "`n=== Migration Complete ===`n" -ForegroundColor Cyan
