# Script to fix validation and handlers in projects-table.tsx
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix validateForm function - replace with projects validation
$pattern = '// Form validation with conditional logic[\s\S]*?return Object\.keys\(errors\)\.length === 0;[\s\S]*?\};'
$replacement = @'
// Form validation
  const validateForm = async () => {
    const errors: Record<string, string> = {};
    
    // Project Name - mandatory, alphanumeric
    if (!formData.projectName.trim()) {
      errors.projectName = 'Project name is required';
    } else if (!/^[a-zA-Z0-9\s]+$/.test(formData.projectName)) {
      errors.projectName = 'Project name must contain only English letters and numbers';
    }
    
    // Date - mandatory, valid date
    if (!formData.date) {
      errors.date = 'Date is required';
    } else if (isNaN(new Date(formData.date).getTime())) {
      errors.date = 'Valid date is required';
    }
    
    // Value - mandatory, must be > 0
    if (!formData.value) {
      errors.value = 'Value is required';
    } else if (parseFloat(formData.value) <= 0) {
      errors.value = 'Value must be greater than 0';
    }
    
    // Counteragent - mandatory
    if (!formData.counteragentUuid) {
      errors.counteragentUuid = 'Counteragent is required';
    }
    
    // Financial Code - mandatory
    if (!formData.financialCodeUuid) {
      errors.financialCodeUuid = 'Financial code is required';
    }
    
    // Currency - mandatory
    if (!formData.currencyUuid) {
      errors.currencyUuid = 'Currency is required';
    }
    
    // State - mandatory
    if (!formData.stateUuid) {
      errors.stateUuid = 'State is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
'@
$content = $content -replace $pattern, $replacement

# Remove the calculateInternalNumber and calculateCounteragent helper functions (not needed for projects)
$content = $content -replace '// Auto-calculation helpers[\s\S]*?return `\$\{name\}\(ს\.კ\. \$\{displayId\} - \$\{entityTypeName\}\)`;[\s\S]*?\};', ''

# Remove entity type and country change handlers (projects don't need them)
$content = $content -replace '// Handler for entity type dropdown change[\s\S]*?setFormErrors\(\{\.\.\.formErrors, country: ''''\}\);[\s\S]*?\};', ''

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Validation and handlers fixed" -ForegroundColor Green
