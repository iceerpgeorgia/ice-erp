# Final fix for projects-table.tsx - fix broken useEffect and other issues
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix the broken fetch dropdown data useEffect - wrap it properly
$content = $content -replace '  // Fetch counteragents', @'
// Fetch dropdown data
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch counteragents
'@

# Fix the entityTypes dependency to projects
$content = $content -replace '\}, \[entityTypes, columns\]\);', '}, [projects, columns]);'

# Add missing employees column to defaultColumns
$content = $content -replace '  \{ key: ''stateUuid'', label: ''State UUID'', width: 200, visible: false, sortable: true, filterable: true, responsive: ''xl'' \}', @'
  { key: 'stateUuid', label: 'State UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'employees', label: 'Employees', width: 200, visible: false, sortable: true, filterable: true, responsive: 'lg' }
'@

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Final fixes applied" -ForegroundColor Green
