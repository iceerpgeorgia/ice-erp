#!/usr/bin/env python3
"""Debug why B3 and B6 insertions fail"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

print("Checking rows 3 and 6:\n")

# Check row 3
print("Row 3:")
row_match = re.search(r'<row r="3"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
if row_match:
    print(f"  Row tag regex: Found")
    row_tag_match = re.search(r'<row r="3"[^>]*>', sheet2_xml)
    print(f"  Exact tag: {row_tag_match.group()}")
    
    # Try the insertion pattern
    cellContent = '<c r="B3"><is><t>LLC</t></is></c>'
    row_pattern = re.compile(r'(<row r="3"[^>]*>)')
    
    if row_pattern.search(sheet2_xml):
        print(f"  Pattern matches: YES")
        test_result = row_pattern.sub(f'\\1{cellContent}', sheet2_xml)
        # Check if it actually inserted
        if f'<c r="B3"' in test_result:
            print(f"  Insertion worked: YES")
        else:
            print(f"  Insertion worked: NO")
            # Debug - show what actually happened
            row_before = re.search(r'<row r="3"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL).group(1)
            row_after = re.search(r'<row r="3"[^>]*>(.*?)</row>', test_result, re.DOTALL).group(1)
            print(f"  BEFORE: {row_before[:150]}")
            print(f"  AFTER:  {row_after[:200]}")
    else:
        print(f"  Pattern matches: NO")

print("\n" + "="*60)
print("\nRow 6:")
row_match = re.search(r'<row r="6"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
if row_match:
    row_tag_match = re.search(r'<row r="6"[^>]*>', sheet2_xml)
    print(f"  Exact tag: {row_tag_match.group()}")
    
    # Check if B6 already exists  
    if re.search(r'<c r="B6"', sheet2_xml):
        print(f"  B6 already exists: YES")
    else:
        print(f"  B6 already exists: NO")
        
        # Try the insertion
        cellContent = '<c r="B6"><is><t>Director</t></is></c>'
        row_pattern = re.compile(r'(<row r="6"[^>]*>)')
        
        if row_pattern.search(sheet2_xml):
            print(f"  Pattern matches: YES")
            test_result = row_pattern.sub(f'\\1{cellContent}', sheet2_xml)
            if f'<c r="B6"' in test_result:
                print(f"  Insertion worked: YES")
            else:
                print(f"  Insertion worked: NO")
        else:
            print(f"  Pattern matches: NO")

# Now test simpler case - just try to do one replacement
print("\n" + "="*60)
print("\nSimple test - insert B3 into row 3:\n")

cellContent = '<c r="B3"><is><t>LLC</t></is></c>'
pattern = re.compile(r'(<row r="3"[^>]*>)')

original_sheet2 = sheet2_xml
result = pattern.sub(f'\\1{cellContent}', original_sheet2)

b3_in_original = '<c r="B3"' in original_sheet2
b3_in_result = '<c r="B3"' in result

print(f"B3 in original: {b3_in_original}")
print(f"B3 in result: {b3_in_result}")

if b3_in_result:
    print("✓ Insertion successful")
    # Show the modified row
    row_content = re.search(r'<row r="3"[^>]*>(.*?)</row>', result, re.DOTALL).group(1)
    print(f"\nRow 3 after insertion (first 200 chars):")
    print(f"  {row_content[:200]}")
else:
    print("✗ Insertion failed")
    print(f"\nPattern test:")
    print(f"  Pattern: {pattern.pattern}")
    print(f"  Matches: {pattern.search(original_sheet2) is not None}")
