Param(
  [string]$SchemaPath = "prisma\schema.prisma"
)

Write-Host "==> Patching $SchemaPath..." -ForegroundColor Cyan
if (!(Test-Path $SchemaPath)) { Write-Error "Schema not found at $SchemaPath"; exit 1 }

# Read entire schema
$content = Get-Content -Raw -Path $SchemaPath

# Insert 'entries Entry[]' into model User { ... } if missing
$userPattern = '(?s)model\s+User\s*\{(.*?)\}'
$entryLine = '  entries Entry[]'
if ($content -match $userPattern) {
  $userBody = $Matches[1]
  if ($userBody -notmatch '(?m)^\s*entries\s+Entry\[\]') {
    Write-Host " - Inserting 'entries Entry[]' into model User" -ForegroundColor Yellow
    $newUserBody = ($userBody.TrimEnd()) + "`r`n" + $entryLine + "`r`n"
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, $userPattern, { param($m) "model User {" + $newUserBody + "}" })
  } else {
    Write-Host " - Model User already contains entries[]" -ForegroundColor DarkGray
  }
} else {
  Write-Warning "Could not find 'model User { ... }'. Skipping relation insertion."
}

# Append Entry model if missing
if ($content -notmatch '(?m)^\s*model\s+Entry\s*\{') {
  Write-Host " - Appending Entry model" -ForegroundColor Yellow
  $entryModel = @"
model Entry {
  id        String   @id @default(cuid())
  userId    String
  project   String
  hours     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
"@
  $content = $content.TrimEnd() + "`r`n`r`n" + $entryModel
} else {
  Write-Host " - Entry model already present" -ForegroundColor DarkGray
}

# Write back (UTF-8 without BOM)
Set-Content -Encoding utf8 -NoNewline -Path $SchemaPath -Value $content
Write-Host " - Wrote schema" -ForegroundColor Green

# Format & generate
Write-Host "==> Running Prisma format/generate..." -ForegroundColor Cyan
& npx prisma format | Write-Host
& npx prisma generate | Write-Host

Write-Host "==> Done. Next: npx prisma migrate dev --name add_entry_model" -ForegroundColor Green
