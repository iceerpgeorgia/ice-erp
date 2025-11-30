# Script to adapt counteragents-table.tsx to projects-table.tsx
$sourceFile = "c:\next-postgres-starter\components\figma\counteragents-table.tsx"
$targetFile = "c:\next-postgres-starter\components\figma\projects-table.tsx"

# Read the source file
$content = Get-Content -Path $sourceFile -Raw

# Replace type definitions
$content = $content -replace 'export type Counteragent = \{[^}]+\};', @'
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

# Replace ColumnKey type
$content = $content -replace 'type ColumnKey = keyof Counteragent;', 'type ColumnKey = keyof Project;'

# Replace defaultColumns array
$content = $content -replace 'const defaultColumns: ColumnConfig\[\] = \[[^\]]+\];', @'
const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: false, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'projectName', label: 'Project Name', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'date', label: 'Date', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'value', label: 'Value', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'oris1630', label: 'ORIS 1630', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'counteragent', label: 'Counteragent', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'financialCode', label: 'Financial Code', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'currency', label: 'Currency', width: 100, visible: true, sortable: true, filterable: true },
  { key: 'state', label: 'State', width: 120, visible: true, sortable: true, filterable: true },
  { key: 'contractNo', label: 'Contract No', width: 150, visible: true, sortable: true, filterable: true },
  { key: 'projectIndex', label: 'Project Index', width: 250, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'counteragentUuid', label: 'Counteragent UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'financialCodeUuid', label: 'Financial Code UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'currencyUuid', label: 'Currency UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'stateUuid', label: 'State UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' }
];
'@

# Basic replacements
$content = $content -replace 'mapCounteragentData', 'mapProjectData'
$content = $content -replace 'CounteragentsTable', 'ProjectsTable'
$content = $content -replace 'counteragents-table-columns', 'projects-table-columns'
$content = $content -replace 'Counteragents', 'Projects'
$content = $content -replace 'counteragents', 'projects'
$content = $content -replace 'Counteragent', 'Project'
$content = $content -replace 'counteragent', 'project'

# Save the file
$content | Set-Content -Path $targetFile -Encoding UTF8

Write-Host "Base structure created" -ForegroundColor Green
Write-Host "Now applying field-specific adaptations" -ForegroundColor Yellow
