$file = 'c:\next-postgres-starter\components\figma\entity-types-table.tsx'
$content = Get-Content $file -Raw

# Remove sample data block
$content = $content -replace '(?s)// Sample data.*?const initialEntityTypes = \[.*?\];', ''

# Remove country-specific interface fields
$content = $content -replace '\s+iso2: string;', ''
$content = $content -replace '\s+iso3: string;', ''
$content = $content -replace '\s+unCode: number;', ''

# Save the fixed content
Set-Content $file -Value $content -NoNewline
Write-Host "Fixed entity-types-table.tsx"
