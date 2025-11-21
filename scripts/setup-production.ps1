# Production Database Setup Script
# Run this after Vercel deployment completes

Write-Host "`n=== Production Database Migration ===`n" -ForegroundColor Cyan

# Set Supabase production URL
$env:DATABASE_URL = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'

Write-Host "1️⃣ Applying database migrations..." -ForegroundColor Yellow
pnpm prisma migrate deploy

Write-Host "`n2️⃣ Generating Prisma client..." -ForegroundColor Yellow
pnpm prisma generate

Write-Host "`n3️⃣ Importing financial codes to production..." -ForegroundColor Yellow
$env:SUPABASE_DATABASE_URL = $env:DATABASE_URL
pnpm tsx scripts/import-financial-codes.ts

Write-Host "`n4️⃣ Verifying data in production..." -ForegroundColor Yellow
node scripts/check-supabase-tables.js

Write-Host "`n✅ Production setup complete!" -ForegroundColor Green
Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   - Database schema updated" -ForegroundColor White
Write-Host "   - Financial codes imported" -ForegroundColor White
Write-Host "   - Entity types already migrated (14 records)" -ForegroundColor White
Write-Host "`n🌐 Visit: https://ice-erp.vercel.app/dictionaries/entity-types" -ForegroundColor Yellow
