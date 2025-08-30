# scripts/fix-counteragents-migrations.ps1
# Cleans old counteragents_reset migrations, syncs schema, reapplies rules.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSCommandPath -Parent) | Out-Null
$Root = Split-Path $PWD -Parent
Set-Location $Root

function Rm-Safe($p) { if (Test-Path $p) { Remove-Item -Recurse -Force $p } }

# 1) Remove any earlier "counteragents_reset" attempts that break shadow DB
Get-ChildItem -Path "prisma\migrations" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'counteragents_reset' } |
  ForEach-Object { Write-Host "Removing $_"; Rm-Safe $_.FullName }

# 2) Make sure the DB has the current columns/shape from prisma/schema.prisma
.\node_modules\.bin\prisma.cmd db push

# 3) Apply the latest rules/triggers migration if present
#    (created by apply-counteragents-v2.ps1; safe to re-run)
.\node_modules\.bin\prisma.cmd migrate dev -n counteragents_rules

# 4) Regenerate client
.\node_modules\.bin\prisma.cmd generate

Write-Host "`n✅ Migrations fixed. Restart the dev server:"
Write-Host "   npm run dev"
Write-Host "Then open http://localhost:3000/dictionaries/counteragents"
