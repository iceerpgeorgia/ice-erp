with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Replace the wrong variable name
content = content.replace("'case1_counteragent_found': case1_counteragent_by_inn,", 
                         "'case1_counteragent_found': case1_counteragent_found,")

# Fix 2: Add missing initialization
lines = content.split('\n')
output = []
for i, line in enumerate(lines):
    output.append(line)
    if line.strip() == 'case1_counteragent_processed = False':
        # Check if next line is NOT already case1_counteragent_found
        if i + 1 < len(lines) and 'case1_counteragent_found' not in lines[i + 1]:
            # Add the missing line with proper indentation
            indent = len(line) - len(line.lstrip())
            output.append(' ' * indent + 'case1_counteragent_found = False')

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("✅ Fixed all case1_counteragent_found issues")
