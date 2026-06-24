#!/usr/bin/env python3
"""Debug step by step what happens to problematic cells"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

# Test just the problematic cells in order: B3, B6, B10, B17, B19
problematic = ['B3', 'B6', 'B10', 'B17', 'B19']

print("=== STEP BY STEP DEBUGGING ===\n")

modifiedXml = sheet2_xml
updates = {}

for cellRef in sorted(['B2', 'B5', 'B9'] + problematic):  # Process in order with some successes first
    value = f"Value_{cellRef}"
    
    isDateCell = cellRef in ['B2']
    
    if isDateCell:
        cellContent = f'<c r="{cellRef}" t="n"><v>{value}</v></c>'
    else:
        cellContent = f'<c r="{cellRef}"><is><t>{value}</t></is></c>'
    
    print(f"\n--- Processing {cellRef} ---")
    
    # Pattern 1
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    if cellPattern.search(modifiedXml):
        print(f"✓ Pattern 1: Cell exists, replacing")
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        updates[cellRef] = 'REPLACED'
        print(f"  After replacement, <c r=\"{cellRef}\" in XML: {f'<c r=\"{cellRef}\"' in modifiedXml}")
        continue
    
    # Pattern 2
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    if emptyPattern.search(modifiedXml):
        print(f"✓ Pattern 2: Empty cell, replacing")
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        updates[cellRef] = 'EMPTY'
        continue
    
    # Pattern 3
    if f'<c r="{cellRef}"' not in modifiedXml:
        rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
        rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
        
        print(f"✗ Pattern 1&2 failed, trying Pattern 3 (insert into row {rowNum})")
        print(f"  Row pattern: {rowPattern.pattern}")
        print(f"  Row exists: {rowPattern.search(modifiedXml) is not None}")
        
        if rowPattern.search(modifiedXml):
            before_insert = modifiedXml
            modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
            after_insert = modifiedXml
            
            if f'<c r="{cellRef}"' in after_insert:
                print(f"✓ Pattern 3: Inserted successfully")
                updates[cellRef] = 'INSERTED'
            else:
                print(f"✗ Pattern 3: Insertion FAILED!")
                print(f"  Before contains {cellRef}: {f'<c r=\"{cellRef}\"' in before_insert}")
                print(f"  After contains {cellRef}: {f'<c r=\"{cellRef}\"' in after_insert}")
                # Show what changed
                row_match_before = rowPattern.search(before_insert)
                row_match_after = rowPattern.search(after_insert)
                if row_match_before and row_match_after:
                    print(f"  Before replacement: ...{row_match_before.group()[:100]}...")
                    print(f"  After replacement: ...{row_match_after.group()[:100]}...")
        else:
            print(f"✗ Row {rowNum} not found!")
            updates[cellRef] = 'NO_ROW'

print("\n" + "="*60)
print("\nFinal status:")
for cellRef in sorted(['B2', 'B5', 'B9'] + problematic):
    status = updates.get(cellRef, 'UNKNOWN')
    present = f'<c r="{cellRef}"' in modifiedXml
    print(f"{cellRef}: {status:15} | Present: {present}")
