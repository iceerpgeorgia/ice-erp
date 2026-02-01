import re

# Read the countries table file
with open(r'c:\next-postgres-starter\components\figma\countries-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the initial sample data section
content = re.sub(
    r'// Sample data matching your exact database schema\nconst initialCountries = \[[\s\S]*?\];',
    '',
    content
)

# Replace type and interfaces
content = content.replace('export type Country = {', 'export type EntityType = {')
content = content.replace('type ColumnKey = keyof Country;', 'type ColumnKey = keyof EntityType;')

# Replace interface fields
content = content.replace('countryUuid: string;', 'entityTypeUuid: string;')
content = re.sub(r'\s+iso2: string;', '', content)
content = re.sub(r'\s+iso3: string;', '', content)
content = re.sub(r'\s+unCode: number;', '', content)
content = content.replace('country: string;', 'nameEn: string;')

# Replace defaultColumns array
old_columns_pattern = r'const defaultColumns: ColumnConfig\[\] = \[[\s\S]*?\];'
new_columns = '''const defaultColumns: ColumnConfig[] = [
  { key: 'id', label: 'ID', width: 80, visible: true, sortable: true, filterable: true },
  { key: 'createdAt', label: 'Created', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'updatedAt', label: 'Updated', width: 140, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'ts', label: 'Timestamp', width: 140, visible: false, sortable: true, filterable: true, responsive: 'lg' },
  { key: 'entityTypeUuid', label: 'UUID', width: 200, visible: false, sortable: true, filterable: true, responsive: 'xl' },
  { key: 'nameEn', label: 'Name EN', width: 200, visible: true, sortable: true, filterable: true },
  { key: 'nameKa', label: 'Name GE', width: 200, visible: true, sortable: true, filterable: true, responsive: 'md' },
  { key: 'isActive', label: 'Status', width: 100, visible: true, sortable: true, filterable: true }
];'''
content = re.sub(old_columns_pattern, new_columns, content)

# Replace function name and state
content = content.replace('export function CountriesTable({ data }: { data?: Country[] })', 
                          'export function EntityTypesTable({ data }: { data?: EntityType[] })')
content = content.replace('const [countries, setCountries] = useState<Country[]>(data ?? initialCountries);',
                          'const [entityTypes, setEntityTypes] = useState<EntityType[]>(data ?? []);')

# Replace all countries references
content = content.replace('countries', 'entityTypes')
content = content.replace('Countries', 'EntityTypes')  
content = content.replace('country', 'entityType')
content = content.replace('Country', 'EntityType')

# Fix localStorage key
content = content.replace("'countries-table-columns'", "'entity-types-table-columns'")

# Fix API endpoints
content = content.replace("'/api/countries", "'/api/entity-types")
content = content.replace('table=countries', 'table=entity_types')

# Write the new file
with open(r'c:\next-postgres-starter\components\figma\entity-types-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Created entity-types-table.tsx successfully")
