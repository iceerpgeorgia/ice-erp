# strip-bom-in-migrations.ps1
# Removes UTF-8 BOM from all prisma\migrations\**\migration.sql files (fixes P3006 'syntax error near "﻿"').
Param(
  [string]$MigrationsPath = "prisma\migrations"
)

if (!(Test-Path $MigrationsPath)) {
  Write-Error "Migrations folder not found: $MigrationsPath"
  exit 1
}

Get-ChildItem -Recurse -Path $MigrationsPath -Filter "migration.sql" | ForEach-Object {
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [System.IO.File]::WriteAllBytes($_.FullName, $bytes[3..($bytes.Length-1)])
    Write-Host "Stripped BOM from $($_.FullName)"
  }
}
Write-Host "BOM scan complete."
