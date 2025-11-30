# Script to fix pagination and unique values in projects-table.tsx
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix pagination
$content = $content -replace 'const totalRecords = sortedEntityTypes\.length;', 'const totalRecords = sortedProjects.length;'
$content = $content -replace 'const paginatedEntityTypes = useMemo', 'const paginatedProjects = useMemo'
$content = $content -replace 'return sortedEntityTypes\.slice', 'return sortedProjects.slice'
$content = $content -replace '\}, \[sortedEntityTypes,', '}, [sortedProjects,'

# Fix getUniqueValues function
$content = $content -replace 'return \[\.\.\.new Set\(entityTypes\.map', 'return [...new Set(projects.map'
$content = $content -replace 'return \[\.\.\.new Set\(Projects\.map', 'return [...new Set(projects.map'

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Pagination and unique values fixed" -ForegroundColor Green
