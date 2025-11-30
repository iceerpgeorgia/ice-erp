# Script to fix projects-table.tsx field mappings
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the file
$content = Get-Content -Path $targetFile -Raw

# Fix the Project type definition - remove duplicate/wrong fields
$content = $content -replace 'export type Project = \{[^}]+\};', @'
export type Project = {
  id: number;
  createdAt: string;
  updatedAt: string;
  projectUuid: string;
  projectName: string;
  date: string;
  value: string | number;
  oris1630: string | null;
  counteragentUuid: string;
  financialCodeUuid: string;
  currencyUuid: string;
  stateUuid: string;
  counteragent: string | null;
  financialCode: string | null;
  currency: string | null;
  state: string | null;
  contractNo: string | null;
  projectIndex: string | null;
  employees?: Array<{
    employeeUuid: string;
    employeeName: string;
  }>;
};
'@

# Fix defaultColumns - correct the labels
$content = $content -replace "\{ key: 'Project', label: 'Project'", "{ key: 'counteragent', label: 'Counteragent'"
$content = $content -replace "\{ key: 'ProjectUuid', label: 'Project UUID'", "{ key: 'counteragentUuid', label: 'Counteragent UUID'"

# Fix mapProjectData function
$content = $content -replace 'const mapProjectData = \(row: any\): Project => \(\{[^}]+\}\);', @'
const mapProjectData = (row: any): Project => ({
  id: row.id || row.ID,
  createdAt: row.created_at || row.createdAt || '',
  updatedAt: row.updated_at || row.updatedAt || '',
  projectUuid: row.project_uuid || row.projectUuid || '',
  projectName: row.project_name || row.projectName || '',
  date: row.date || row.DATE || '',
  value: row.value || row.VALUE || 0,
  oris1630: row.oris_1630 || row.oris1630 || null,
  counteragentUuid: row.counteragent_uuid || row.counteragentUuid || '',
  financialCodeUuid: row.financial_code_uuid || row.financialCodeUuid || '',
  currencyUuid: row.currency_uuid || row.currencyUuid || '',
  stateUuid: row.state_uuid || row.stateUuid || '',
  counteragent: row.counteragent || row.COUNTERAGENT || null,
  financialCode: row.financial_code || row.financialCode || null,
  currency: row.currency || row.CURRENCY || null,
  state: row.state || row.STATE || null,
  contractNo: row.contract_no || row.contractNo || null,
  projectIndex: row.project_index || row.projectIndex || null,
  employees: row.employees || []
});
'@

# Fix state variable names
$content = $content -replace '\[entityTypes, setEntityTypes\] = useState<Project\[\]>', '[projects, setProjects] = useState<Project[]>'
$content = $content -replace 'const \[editingEntityType, setEditingEntityType\]', 'const [editingProject, setEditingProject]'
$content = $content -replace 'setEntityTypes\(data\)', 'setProjects(data)'

# Fix dropdown state variables
$content = $content -replace 'const \[entityTypesList, setEntityTypesList\] = useState<Array<\{id: number, nameKa: string, entityTypeUuid: string\}>>',  'const [counteragentsList, setCounteragentsList] = useState<Array<{id: number, name: string, counteragentUuid: string}>>'
$content = $content -replace 'const \[countriesList, setCountriesList\] = useState<Array<\{id: number, country: string, countryUuid: string\}>>',  'const [financialCodesList, setFinancialCodesList] = useState<Array<{id: number, validation: string, uuid: string}>>'

# Add missing state variables after countriesList line
$content = $content -replace '(const \[financialCodesList.*\]\(\[\]\);)', @'
$1
  const [currenciesList, setCurrenciesList] = useState<Array<{id: number, code: string, uuid: string}>>([]);
  const [statesList, setStatesList] = useState<Array<{id: number, name: string, uuid: string}>>([]);
  const [employeesList, setEmployeesList] = useState<Array<{id: number, name: string, counteragentUuid: string}>>([]);
'@

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8 -NoNewline

Write-Host "Field mappings fixed" -ForegroundColor Green
