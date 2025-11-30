# Script to fix CRUD operations in projects-table.tsx
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix handleSave function - replace entire function
$pattern = 'const handleSave = async \(\) => \{[\s\S]*?resetForm\(\);[\s\S]*?\};'
$replacement = @'
const handleSave = async () => {
    if (!(await validateForm())) return;
    
    if (editingProject) {
      // Update existing project via API
      try {
        const response = await fetch(`/api/projects?id=${editingProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: formData.projectName,
            date: formData.date,
            value: parseFloat(formData.value),
            oris_1630: formData.oris1630 || null,
            counteragent_uuid: formData.counteragentUuid,
            financial_code_uuid: formData.financialCodeUuid,
            currency_uuid: formData.currencyUuid,
            state_uuid: formData.stateUuid,
            employees: formData.employees
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Edit] API error:', error);
          alert(`Failed to update: ${error.error || 'Unknown error'}`);
          return;
        }
        
        // Refresh data
        const refreshResponse = await fetch('/api/projects');
        const refreshedData = await refreshResponse.json();
        const mappedData = refreshedData.map(mapProjectData);
        setProjects(mappedData);
        
        setIsEditDialogOpen(false);
        setEditingProject(null);
      } catch (error) {
        console.error('[Edit] Network error:', error);
        alert('Failed to update project. Please try again.');
        return;
      }
    } else {
      // Add new project via API
      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: formData.projectName,
            date: formData.date,
            value: parseFloat(formData.value),
            oris1630: formData.oris1630 || null,
            counteragentUuid: formData.counteragentUuid,
            financialCodeUuid: formData.financialCodeUuid,
            currencyUuid: formData.currencyUuid,
            stateUuid: formData.stateUuid,
            employees: formData.employees
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[Add] API error:', error);
          alert(`Failed to add: ${error.error || 'Unknown error'}`);
          return;
        }
        
        // Refresh data
        const refreshResponse = await fetch('/api/projects');
        const refreshedData = await refreshResponse.json();
        const mappedData = refreshedData.map(mapProjectData);
        setProjects(mappedData);
        
        setIsAddDialogOpen(false);
      } catch (error) {
        console.error('[Add] Network error:', error);
        alert('Failed to add project. Please try again.');
        return;
      }
    }
    
    resetForm();
  };
'@
$content = $content -replace $pattern, $replacement

# Fix resetForm function
$pattern = 'const resetForm = \(\) => \{[\s\S]*?\};'
$replacement = @'
const resetForm = () => {
    setFormData({
      projectName: '',
      date: '',
      value: '',
      oris1630: '',
      counteragentUuid: '',
      financialCodeUuid: '',
      currencyUuid: '',
      stateUuid: '',
      employees: []
    });
    setFormErrors({});
  };
'@
$content = $content -replace $pattern, $replacement

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "CRUD operations fixed" -ForegroundColor Green
