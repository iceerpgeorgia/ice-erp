param([string]$DatabaseUrl='postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public')
$ErrorActionPreference = 'Stop'
$env:DATABASE_URL = $DatabaseUrl
$sql    = Join-Path $PSScriptRoot 'scripts\auditlog.sql'
$schema = Join-Path $PSScriptRoot 'prisma\schema.prisma'
try {
  npx prisma db execute --file $sql --schema $schema
  Write-Host 'AuditLog ensured via prisma db execute.' -ForegroundColor Green
} catch {
  Write-Warning ('Prisma db execute failed: ' + $_.Exception.Message)
  Write-Host 'Falling back to Node script ensure_auditlog.js...'
  node (Join-Path $PSScriptRoot 'scripts\ensure_auditlog.js')
}
