#!/usr/bin/env python3
"""Debug what happens when inserting into row 1"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

print("BEFORE insertion:")
# Count rows
rows_before = re.findall(r'<row r="(\d+)"', sheet2_xml)
print(f"  Rows found: {sorted(set(map(int, rows_before)))}")

# Check for row 1
row1_before = re.search(r'<row r="1"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
print(f"  Row 1 tag: {row1_before.group(0)[:150] if row1_before else 'NOT FOUND'}...")

print("\n" + "="*60)

# Now do the insertion
cellContent = '<c r="B1"><is><t>Value_B1</t></is></c>'
rowPattern = re.compile(r'(<row r="1"[^>]*>)')

print(f"\nInserting B1 into row 1...")
print(f"  Pattern: {rowPattern.pattern}")
print(f"  Pattern matches: {bool(rowPattern.search(sheet2_xml))}")

modified = rowPattern.sub(f'\\1{cellContent}', sheet2_xml)

print(f"  Match was found and replaced")

print("\nAFTER insertion:")
# Count rows
rows_after = re.findall(r'<row r="(\d+)"', modified)
print(f"  Rows found: {sorted(set(map(int, rows_after)))}")

# Check for row 1
row1_after = re.search(r'<row r="1"[^>]*>(.*?)</row>', modified, re.DOTALL)
print(f"  Row 1 tag: {row1_after.group(0)[:200] if row1_after else 'NOT FOUND'}...")

# Check specific rows
for row_num in [1, 3, 6, 10, 17, 19]:
    pattern = re.compile(f'<row r="{row_num}"[^>]*>')
    found_before = bool(pattern.search(sheet2_xml))
    found_after = bool(pattern.search(modified))
    print(f"\n  Row {row_num}: Before={found_before}, After={found_after}")

# Let me check if there's an issue with the regex itself
print("\n" + "="*60)
print("\nDirect string searches for rows:")

for row_num in [1, 3, 6, 10]:
    search_str = f'<row r="{row_num}"'
    print(f"  '{search_str}' in modified: {search_str in modified}")

# Check if the XML is well-formed
print("\n" + "="*60)
print("\nXML structure check:")
opening_rows = len(re.findall(r'<row', modified))
closing_rows = len(re.findall(r'</row>', modified))
print(f"  <row tags: {opening_rows}")
print(f"  </row> tags: {closing_rows}")

if opening_rows != closing_rows:
    print(f"  ERROR: Mismatched row tags! ({opening_rows} vs {closing_rows})")
