# Script to fix form data and API calls in projects-table.tsx
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix form data state - replace the entire formData useState
$pattern = "const \[formData, setFormData\] = useState\(\{[^}]+\}\);"
$replacement = @'
const [formData, setFormData] = useState({
    projectName: '',
    date: '',
    value: '',
    oris1630: '',
    counteragentUuid: '',
    financialCodeUuid: '',
    currencyUuid: '',
    stateUuid: '',
    employees: [] as string[]
  });
'@
$content = $content -replace $pattern, $replacement

# Fix the fetchDropdownData useEffect - replace entity-types and countries with projects dropdowns
$content = $content -replace '// Fetch entity types[\s\S]*?setCountriesList\(countriesData\);[\s\S]*?\}', @'
// Fetch counteragents
        const counteragentsRes = await fetch('/api/counteragents');
        if (counteragentsRes.ok) {
          const counteragentsData = await counteragentsRes.json();
          setCounteragentsList(counteragentsData.map((c: any) => ({
            id: c.id,
            name: c.name,
            counteragentUuid: c.counteragent_uuid || c.counteragentUuid
          })));
        }
        
        // Fetch financial codes
        const financialCodesRes = await fetch('/api/financial-codes');
        if (financialCodesRes.ok) {
          const financialCodesData = await financialCodesRes.json();
          setFinancialCodesList(financialCodesData.map((fc: any) => ({
            id: fc.id,
            validation: fc.validation,
            uuid: fc.uuid || fc.financial_code_uuid
          })));
        }
        
        // Fetch currencies
        const currenciesRes = await fetch('/api/currencies');
        if (currenciesRes.ok) {
          const currenciesData = await currenciesRes.json();
          setCurrenciesList(currenciesData.map((c: any) => ({
            id: c.id,
            code: c.code,
            uuid: c.uuid || c.currency_uuid
          })));
        }
        
        // Fetch states
        const statesRes = await fetch('/api/project-states');
        if (statesRes.ok) {
          const statesData = await statesRes.json();
          setStatesList(statesData.map((s: any) => ({
            id: s.id,
            name: s.name,
            uuid: s.uuid || s.state_uuid
          })));
        }
        
        // Fetch employees (counteragents with is_emploee=true)
        const employeesRes = await fetch('/api/counteragents?is_emploee=true');
        if (employeesRes.ok) {
          const employeesData = await employeesRes.json();
          setEmployeesList(employeesData.map((e: any) => ({
            id: e.id,
            name: e.name,
            counteragentUuid: e.counteragent_uuid || e.counteragentUuid
          })));
        }
'@

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Form data and API calls fixed" -ForegroundColor Green
