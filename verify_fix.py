#!/usr/bin/env python3
"""Verify the fixed pattern works"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

# Process all 19 cells with FIXED patterns
cellsToUpdate = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19']

modifiedXml = sheet2_xml
results = {}

print("=== TESTING FIXED PATTERNS ===\n")

for cellRef in cellsToUpdate:
    value = f"Val_{cellRef}"
    isDateCell = cellRef in ['B2', 'B18']
    
    if isDateCell:
        cellContent = f'<c r="{cellRef}" t="n"><v>{value}</v></c>'
    else:
        cellContent = f'<c r="{cellRef}"><is><t>{value}</t></is></c>'
    
    updated = False
    
    # FIXED Pattern 2a: Check self-closing FIRST
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    if emptyPattern.search(modifiedXml):
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        results[cellRef] = 'P2a_SELFCLOSING'
        print(f"{cellRef}: Pattern 2a - Replaced self-closing tag")
        updated = True
    
    # FIXED Pattern 1: Use [^<]*</c> to not match across rows
    if not updated:
        cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>[^<]*</c>', re.DOTALL)
        if cellPattern.search(modifiedXml):
            modifiedXml = cellPattern.sub(cellContent, modifiedXml)
            results[cellRef] = 'P1_NONEMPTY'
            print(f"{cellRef}: Pattern 1 - Replaced non-empty cell")
            updated = True
    
    # Pattern 3: Insert into row if not found
    if not updated:
        if f'<c r="{cellRef}"' not in modifiedXml:
            rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
            rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
            
            if rowPattern.search(modifiedXml):
                modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
                results[cellRef] = 'P3_INSERTED'
                print(f"{cellRef}: Pattern 3 - Inserted into row")
                updated = True
            else:
                results[cellRef] = 'NO_ROW'
                print(f"{cellRef}: ERROR - Row not found!")
                updated = True

# Final verification
print("\n" + "="*60)
print("FINAL RESULT:\n")

all_present = True
for cellRef in cellsToUpdate:
    present = f'<c r="{cellRef}"' in modifiedXml
    result_type = results.get(cellRef, '?')
    if present:
        print(f"✓ {cellRef}: {result_type:15} Present: True")
    else:
        print(f"✗ {cellRef}: {result_type:15} Present: False")
        all_present = False

total_present = sum(1 for cellRef in cellsToUpdate if f'<c r="{cellRef}"' in modifiedXml)
print(f"\nTotal: {total_present}/{len(cellsToUpdate)} cells present")

if all_present:
    print("\n✅ SUCCESS - All cells properly updated!")
else:
    print(f"\n❌ FAILURE - {len(cellsToUpdate) - total_present} cells missing")
