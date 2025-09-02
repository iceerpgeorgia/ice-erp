# prisma-baseline-from-db.ps1
# 1) Pull the live DB schema into prisma/schema.prisma
npx prisma db pull

# 2) Create a baseline migration (SQL) representing current DB state
$baselineDir = "prisma/migrations/0001_baseline"
if (!(Test-Path $baselineDir)) { New-Item -ItemType Directory -Force -Path $baselineDir | Out-Null }
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script `
  | Out-File -Encoding utf8 "$baselineDir/migration.sql"

# 3) Mark the baseline as applied so Prisma won't try to run it
npx prisma migrate resolve --applied 0001_baseline
