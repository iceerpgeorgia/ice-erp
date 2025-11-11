# Set Supabase connection for data migration
# Run this with: . .\scripts\set-supabase-env.ps1

$env:SUPABASE_DATABASE_URL="postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

Write-Host "✓ SUPABASE_DATABASE_URL set for this session" -ForegroundColor Green
Write-Host "Connection: " -NoNewline
Write-Host $env:SUPABASE_DATABASE_URL.Replace(":fulebimojviT1985%", ":****") -ForegroundColor Cyan
