#!/usr/bin/env python3
"""Debug the B2 replacement that breaks row 3"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

# First insert B1
modifiedXml = sheet2_xml
cellContent_b1 = '<c r="B1"><is><t>Val_B1</t></is></c>'
rowPattern_b1 = re.compile(r'(<row r="1"[^>]*>)')
modifiedXml = rowPattern_b1.sub(f'\\1{cellContent_b1}', modifiedXml)

print("After B1 insertion (Before B2 replacement):")
print(f"  Row 2 found: {bool(re.search(r'<row r=\"2\"', modifiedXml))}")
print(f"  Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml))}")

# Show row 2 and row 3 context
row2_match = re.search(r'(<row r="2"[^>]*>.*?</row>)', modifiedXml, re.DOTALL)
row3_match = re.search(r'(<row r="3"[^>]*>.*?</row>)', modifiedXml, re.DOTALL)

if row2_match:
    print(f"\n  Row 2: {row2_match.group(1)[:200]}...")
if row3_match:
    print(f"  Row 3 (first 100 chars): {row3_match.group(1)[:100]}...")

print("\n" + "="*60)
print("\nNow replacing B2...")

# Try to replace B2
cellContent_b2 = '<c r="B2" t="n"><v>44719</v></c>'
cellPattern_b2 = re.compile(f'<c r="B2"[^>]*>.*?</c>', re.DOTALL)

print(f"  B2 pattern: {cellPattern_b2.pattern}")
print(f"  B2 pattern matches: {bool(cellPattern_b2.search(modifiedXml))}")

if cellPattern_b2.search(modifiedXml):
    match_obj = cellPattern_b2.search(modifiedXml)
    print(f"\n  B2 match found:")
    print(f"    Start: position {match_obj.start()}")
    print(f"    End: position {match_obj.end()}")
    print(f"    Content: {match_obj.group()[:150]}...")
    
    # Show context around the match
    start = max(0, match_obj.start() - 50)
    end = min(len(modifiedXml), match_obj.end() + 50)
    print(f"\n  Context around match:")
    print(f"    ...{modifiedXml[start:match_obj.start()]}")
    print(f"    [{match_obj.group()[:100]}...]")
    print(f"    {modifiedXml[match_obj.end():end]}...")
    
    # Do the replacement
    modifiedXml_after = cellPattern_b2.sub(cellContent_b2, modifiedXml)
    
    print(f"\nAfter B2 replacement:")
    print(f"  Row 2 found: {bool(re.search(r'<row r=\"2\"', modifiedXml_after))}")
    print(f"  Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml_after))}")
    
    # Check for extra or deleted content
    removed = len(modifiedXml) - len(modifiedXml_after)
    print(f"  Size change: {removed} bytes")
    
    # Find where row 2 and 3 are now
    if '<row r="2"' not in modifiedXml_after:
        print(f"  ✗ Row 2 DISAPPEARED!")
        if '<row r="2"' in modifiedXml:
            print(f"    Row 2 was at position {modifiedXml.find('<row r=\"2\"')}")
    
    if '<row r="3"' not in modifiedXml_after:
        print(f"  ✗ Row 3 DISAPPEARED!")
        # Try to find where row 3 was
        idx3_before = modifiedXml.find('<row r="3"')
        idx3_after = modifiedXml_after.find('<row r="3"')
        print(f"    Row 3 was at position {idx3_before}, now at {idx3_after}")
