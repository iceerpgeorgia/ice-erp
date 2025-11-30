import re

# Read the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix onValueChange parameter types by adding explicit types
content = re.sub(r'onValueChange=\{\(value\) =>', 'onValueChange={(value: string) =>', content)

# Remove the countriesList special handling in audit logs - replace entire conditional
audit_pattern = r'\{\(field === \'country_uuid\' \|\| field === \'country_uuid_label\'\) \? \([\s\S]*?\) : \('
audit_replacement = '{'

content = re.sub(audit_pattern, audit_replacement, content)

# Clean up any remaining countriesList references - simple replace
content = content.replace('countriesList', '// countriesList not needed for projects')

# Save
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All remaining type errors fixed!")
