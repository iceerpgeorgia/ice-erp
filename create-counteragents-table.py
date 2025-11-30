#!/usr/bin/env python3
"""
Create counteragents-table.tsx from entity-types-table.tsx
with 29 fields for Counteragent model.
"""

import re

# Read the entity-types-table.tsx
with open('components/figma/entity-types-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace type name
content = re.sub(r'\bEntityType\b', 'Counteragent', content)
content = re.sub(r'\bentityType\b', 'counteragent', content)
content = re.sub(r'\bEntity Types\b', 'Counteragents', content)
content = re.sub(r'\bentity types\b', 'counteragents', content)
content = re.sub(r'\bEntity Type\b', 'Counteragent', content)
content = re.sub(r'\bentity type\b', 'counteragent', content)

# Replace API endpoints
content = content.replace('/api/entity-types', '/api/counteragents')
content = content.replace('entity-types-', 'counteragents-')

# Replace localStorage keys
content = content.replace('entityTypesColumns', 'counteragentsColumns')
content = content.replace('entityTypesColumnWidths', 'counteragentsColumnWidths')

# Replace interface - find and replace the EntityType interface definition
interface_old = r'interface Counteragent \{[^}]+\}'
interface_new = """interface Counteragent {
  id: number;
  createdAt: string;
  updatedAt: string;
  ts: string;
  counteragentUuid: string;
  name: string;
  identificationNumber: string | null;
  birthOrIncorporationDate: string | null;
  entityType: string | null;
  sex: string | null;
  pensionScheme: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  zipCode: string | null;
  iban: string | null;
  swift: string | null;
  director: string | null;
  directorId: string | null;
  email: string | null;
  phone: string | null;
  orisId: string | null;
  counteragent: string | null;
  countryUuid: string | null;
  entityTypeUuid: string | null;
  internalNumber: string | null;
  isActive: boolean;
}"""
content = re.sub(interface_old, interface_new, content)

# Replace defaultColumns array
columns_pattern = r'const defaultColumns: Column\[\] = \[[^\]]+\];'
columns_new = """const defaultColumns: Column[] = [
  { key: 'id', label: 'ID', visible: false },
  { key: 'createdAt', label: 'Created At', visible: false },
  { key: 'updatedAt', label: 'Updated At', visible: false },
  { key: 'ts', label: 'Timestamp', visible: false },
  { key: 'counteragentUuid', label: 'UUID', visible: false },
  { key: 'name', label: 'Name', visible: true },
  { key: 'identificationNumber', label: 'ID Number', visible: true },
  { key: 'birthOrIncorporationDate', label: 'Birth/Inc Date', visible: true },
  { key: 'entityType', label: 'Entity Type', visible: true },
  { key: 'sex', label: 'Sex', visible: true },
  { key: 'pensionScheme', label: 'Pension Scheme', visible: false },
  { key: 'country', label: 'Country', visible: true },
  { key: 'addressLine1', label: 'Address 1', visible: true },
  { key: 'addressLine2', label: 'Address 2', visible: false },
  { key: 'zipCode', label: 'Zip Code', visible: false },
  { key: 'iban', label: 'IBAN', visible: false },
  { key: 'swift', label: 'SWIFT', visible: false },
  { key: 'director', label: 'Director', visible: false },
  { key: 'directorId', label: 'Director ID', visible: false },
  { key: 'email', label: 'Email', visible: true },
  { key: 'phone', label: 'Phone', visible: true },
  { key: 'orisId', label: 'ORIS ID', visible: false },
  { key: 'counteragent', label: 'Counteragent', visible: false },
  { key: 'countryUuid', label: 'Country UUID', visible: false },
  { key: 'entityTypeUuid', label: 'Entity Type UUID', visible: false },
  { key: 'internalNumber', label: 'Internal #', visible: false },
  { key: 'isActive', label: 'Status', visible: true },
];"""
content = re.sub(columns_pattern, columns_new, content, flags=re.DOTALL)

# Replace formData state initialization
formdata_pattern = r'const \[formData, setFormData\] = useState<\{[^}]+\}>\([^)]+\);'
formdata_new = """const [formData, setFormData] = useState<{
    name: string;
    identificationNumber: string;
    birthOrIncorporationDate: string;
    entityType: string;
    sex: string;
    pensionScheme: string;
    country: string;
    addressLine1: string;
    addressLine2: string;
    zipCode: string;
    iban: string;
    swift: string;
    director: string;
    directorId: string;
    email: string;
    phone: string;
    orisId: string;
    counteragent: string;
    countryUuid: string;
    entityTypeUuid: string;
    internalNumber: string;
    isActive: boolean;
  }>({
    name: '',
    identificationNumber: '',
    birthOrIncorporationDate: '',
    entityType: '',
    sex: '',
    pensionScheme: '',
    country: '',
    addressLine1: '',
    addressLine2: '',
    zipCode: '',
    iban: '',
    swift: '',
    director: '',
    directorId: '',
    email: '',
    phone: '',
    orisId: '',
    counteragent: '',
    countryUuid: '',
    entityTypeUuid: '',
    internalNumber: '',
    isActive: true,
  });"""
content = re.sub(formdata_pattern, formdata_new, content, flags=re.DOTALL)

# Remove sample data
content = re.sub(r'const sampleData: Counteragent\[\] = \[[^\]]+\];', 'const sampleData: Counteragent[] = [];', content, flags=re.DOTALL)

# Write output
with open('components/figma/counteragents-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Created components/figma/counteragents-table.tsx")
print("Next steps:")
print("1. Update validateForm function for counteragent-specific validation")
print("2. Update dialog forms with all 29 fields organized in sections")
print("3. Add foreign key lookups for entity_type and country dropdowns")
