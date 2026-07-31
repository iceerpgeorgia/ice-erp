#!/usr/bin/env python3
"""Debug why the row pattern matching fails for certain rows"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

# Check each problematic row
problem_rows = [3, 6, 10, 17, 19]

print("Checking why row pattern matching fails:\n")

for row_num in problem_rows:
    # Try to find the row
    row_pattern = re.compile(f'(<row r="{row_num}"[^>]*>)')
    
    if row_pattern.search(sheet2_xml):
        print(f"✓ Row {row_num}: EXISTS in XML")
        
        # Extract the row content to see what's there
        row_match = re.search(f'<row r="{row_num}"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
        if row_match:
            row_content = row_match.group(1)
            cells = re.findall(r'<c r="([A-Z]+\d+)"', row_content)
            print(f"  Cells in row: {cells}")
            
            # Show row opening tag
            row_tag_match = re.search(f'<row r="{row_num}"[^>]*>', sheet2_xml)
            if row_tag_match:
                print(f"  Row tag: {row_tag_match.group()[:100]}")
    else:
        print(f"✗ Row {row_num}: NOT FOUND in XML")

# Now let's see what the actual issue is
print("\n" + "="*60)
print("Checking actual content of these rows:\n")

rows_xml = re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
for row_match in rows_xml:
    row_num = int(row_match.group(1))
    if row_num in problem_rows:
        row_content = row_match.group(2)
        print(f"Row {row_num} content (first 200 chars):")
        print(f"  {row_content[:200]}")
        print()
