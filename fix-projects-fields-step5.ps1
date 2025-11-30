# Script to fix edit, filter, and table rendering in projects-table.tsx
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix startEdit function
$pattern = 'const startEdit = \(Project: Project\) => \{[\s\S]*?setIsEditDialogOpen\(true\);[\s\S]*?\};'
$replacement = @'
const startEdit = (project: Project) => {
    setEditingProject(project);
    // Format date to YYYY-MM-DD for input[type="date"]
    const formatDateForInput = (dateStr: string | null) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    setFormData({
      projectName: project.projectName || '',
      date: formatDateForInput(project.date),
      value: String(project.value || ''),
      oris1630: project.oris1630 || '',
      counteragentUuid: project.counteragentUuid || '',
      financialCodeUuid: project.financialCodeUuid || '',
      currencyUuid: project.currencyUuid || '',
      stateUuid: project.stateUuid || '',
      employees: (project.employees || []).map(e => e.employeeUuid)
    });
    setFormErrors({});
    setIsEditDialogOpen(true);
  };
'@
$content = $content -replace $pattern, $replacement

# Fix cancelEdit function
$content = $content -replace 'const cancelEdit = \(\) => \{[\s\S]*?\};', @'
const cancelEdit = () => {
    setEditingProject(null);
    setIsEditDialogOpen(false);
    resetForm();
  };
'@

# Fix deleteEntityType to deleteProject
$content = $content -replace 'const deleteEntityType = \(id: number\) => \{[\s\S]*?\};', @'
const deleteProject = (id: number) => {
    setProjects(projects.filter(p => p.id !== id));
  };
'@

# Fix viewAuditLog function
$content = $content -replace 'const viewAuditLog = async \(Project: Project\) => \{', 'const viewAuditLog = async (project: Project) => {'
$content = $content -replace 'setEditingEntityType\(Project\);', 'setEditingProject(project);'
$content = $content -replace "fetch\(`/api/audit\?table=Projects", "fetch(`/api/audit?table=projects"
$content = $content -replace 'recordId=\$\{Project\.id\}', 'recordId=${project.id}'

# Fix filtered logic
$pattern = 'const filteredEntityTypes = useMemo\(\(\) => \{[\s\S]*?return filtered;[\s\S]*?\}, \[entityTypes, searchTerm, columnFilters\]\);'
$replacement = @'
const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Apply search across all visible text fields
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        (project.projectName || '').toLowerCase().includes(search) ||
        (project.counteragent || '').toLowerCase().includes(search) ||
        (project.financialCode || '').toLowerCase().includes(search) ||
        (project.currency || '').toLowerCase().includes(search) ||
        (project.state || '').toLowerCase().includes(search) ||
        (project.contractNo || '').toLowerCase().includes(search)
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(project => {
          const cellValue = String(project[column as ColumnKey]);
          return values.includes(cellValue);
        });
      }
    });

    return filtered;
  }, [projects, searchTerm, columnFilters]);
'@
$content = $content -replace $pattern, $replacement

# Fix sortedEntityTypes
$content = $content -replace 'const sortedEntityTypes', 'const sortedProjects'
$content = $content -replace 'return \[\.\.\.filteredEntityTypes\]', 'return [...filteredProjects]'
$content = $content -replace '\}, \[filteredEntityTypes,', '}, [filteredProjects,'

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Edit, filter, and table rendering fixed" -ForegroundColor Green
