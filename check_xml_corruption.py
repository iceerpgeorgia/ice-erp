#!/usr/bin/env python3
"""Check if XML gets corrupted after insertions"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

modifiedXml = sheet2_xml

print("BEFORE any modifications:")
print(f"  Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml))}")
print(f"  Row 6 found: {bool(re.search(r'<row r=\"6\"', modifiedXml))}")
print(f"  Row 10 found: {bool(re.search(r'<row r=\"10\"', modifiedXml))}")

# Insert into row 10
rowPattern = re.compile(r'(<row r="10"[^>]*>)')
cellContent = '<c r="B10"><is><t>Value_B10</t></is></c>'
print(f"\nInserting into row 10...")
print(f"  Pattern matches: {bool(rowPattern.search(modifiedXml))}")

modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
print(f"  After insertion:")
print(f"    Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml))}")
print(f"    Row 6 found: {bool(re.search(r'<row r=\"6\"', modifiedXml))}")
print(f"    Row 10 found: {bool(re.search(r'<row r=\"10\"', modifiedXml))}")
print(f"    B10 found: {bool(re.search(r'<c r=\"B10\"', modifiedXml))}")

# Try to find row 3 after the insertion
print(f"\nLooking for row 3 patterns:")
row3_pattern = re.compile(r'<row r="3"[^>]*>')
match = row3_pattern.search(modifiedXml)
print(f"  Simple pattern match: {match is not None}")

if not match:
    # Maybe the row tag was affected?
    # Let me search for row 3 more broadly
    if 'r="3"' in modifiedXml:
        print(f"  'r=\"3\"' still exists in XML")
        # Find where it appears
        idx = modifiedXml.find('r="3"')
        print(f"  Context: ...{modifiedXml[max(0, idx-50):idx+50]}...")
    else:
        print(f"  'r=\"3\"' MISSING from XML!")
        # Check if the entire XML got broken
        print(f"\n  Checking XML integrity...")
        # Count opening and closing tags
        print(f"    <row tags: {len(re.findall(r'<row', modifiedXml))}")
        print(f"    </row tags: {len(re.findall(r'</row>', modifiedXml))}")
