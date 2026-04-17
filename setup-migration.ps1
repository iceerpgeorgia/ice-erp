#!/usr/bin/env pwsh
# Setup script for Google Drive to Supabase migration

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Google Drive Migration Setup                       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check dependencies
Write-Host "Step 1: Checking dependencies..." -ForegroundColor Yellow

$hasXlsx = pnpm list xlsx 2>$null
$hasSupabase = pnpm list @supabase/supabase-js 2>$null

if (!$hasXlsx -or !$hasSupabase) {
    Write-Host "  Installing required packages..." -ForegroundColor Yellow
    pnpm install xlsx @supabase/supabase-js
    Write-Host "  ✓ Packages installed" -ForegroundColor Green
} else {
    Write-Host "  ✓ All packages already installed" -ForegroundColor Green
}

Write-Host ""

# Step 2: Create template Excel file
Write-Host "Step 2: Creating reference files..." -ForegroundColor Yellow

if (Test-Path "export-reference-uuids.js") {
    Write-Host "  Exporting UUIDs from database..." -ForegroundColor Yellow
    node export-reference-uuids.js
    Write-Host "  ✓ Created reference-uuids.xlsx" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  export-reference-uuids.js not found" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Check Supabase environment variables
Write-Host "Step 3: Checking Supabase configuration..." -ForegroundColor Yellow

if ($env:NEXT_PUBLIC_SUPABASE_URL -and $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "  ✓ Supabase environment variables configured" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Missing Supabase environment variables" -ForegroundColor Yellow
    Write-Host "  Required in .env.local:" -ForegroundColor Yellow
    Write-Host "    NEXT_PUBLIC_SUPABASE_URL=..." -ForegroundColor Gray
    Write-Host "    SUPABASE_SERVICE_ROLE_KEY=..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Setup Complete!                                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Prepare your Excel file with columns:" -ForegroundColor White
Write-Host "   - file_name, gdrive_url (required)" -ForegroundColor Cyan
Write-Host "   - project_uuid, document_type_uuid, currency_uuid (recommended)" -ForegroundColor Cyan
Write-Host "   - document_date, document_no, document_value (optional)" -ForegroundColor Cyan
Write-Host "2. Use reference-uuids.xlsx to look up UUIDs by name" -ForegroundColor White
Write-Host "3. Make sure files in Google Drive are shareable (Anyone with link)" -ForegroundColor White
Write-Host "4. Validate your Excel file:" -ForegroundColor White
Write-Host "   node validate-migration.js your-file.xlsx" -ForegroundColor Cyan
Write-Host "5. Run dry-run test:" -ForegroundColor White
Write-Host "   node migrate-gdrive-attachments.js your-file.xlsx --dry-run" -ForegroundColor Cyan
Write-Host "6. Run actual migration:" -ForegroundColor White
Write-Host "   node migrate-gdrive-attachments.js your-file.xlsx" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed instructions, see: MIGRATION_UUID_QUICKSTART.md" -ForegroundColor Gray
