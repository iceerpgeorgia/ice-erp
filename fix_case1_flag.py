with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix both locations where we need to add case1_counteragent_found initialization
output = []
for i, line in enumerate(lines):
    output.append(line)
    if line.strip() == 'case1_counteragent_processed = False':
        # Check if next line is NOT already case1_counteragent_found
        if i + 1 < len(lines) and 'case1_counteragent_found' not in lines[i + 1]:
            # Add the missing line with proper indentation
            indent = len(line) - len(line.lstrip())
            output.append(' ' * indent + 'case1_counteragent_found = False\n')

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("✅ Added case1_counteragent_found initialization")
