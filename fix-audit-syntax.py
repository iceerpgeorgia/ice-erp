import re

# Read the file
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and fix the problematic lines (around line 1447)
for i, line in enumerate(lines):
    if '{' in line and '<>' in line and 'text-red-600' in lines[i+1] if i+1 < len(lines) else False:
        # Remove the orphaned opening brace and fragment
        lines[i] = line.replace('{\n', '').replace('<>\n', '')
        
    if '</>' in line and ')}' in line:
        # Remove the closing fragment and extra closing paren
        lines[i] = line.replace('</>\n', '').replace(')}', '')

# Save
with open(r'c:\next-postgres-starter\components\figma\projects-table.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Audit log syntax fixed!")
