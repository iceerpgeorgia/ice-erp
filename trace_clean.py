#!/usr/bin/env python3
"""Clean trace of what actually happens"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

#  Let's process in EXACTLY the same order as API code does
cellsToUpdate = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19']

modifiedXml = sheet2_xml
results = {}

print("=== PROCESSING IN API ORDER ===\n")

for cellRef in cellsToUpdate:
    value = f"Val_{cellRef}"
    isDateCell = cellRef in ['B2', 'B18']
    
    if isDateCell:
        cellContent = f'<c r="{cellRef}" t="n"><v>{value}</v></c>'
    else:
        cellContent = f'<c r="{cellRef}"><is><t>{value}</t></is></c>'
    
    # Pattern 1
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    match1 = cellPattern.search(modifiedXml)
    
    if match1:
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        results[cellRef] = 'P1_REPLACED'
        print(f"{cellRef}: Pattern 1 - Replaced existing cell")
        continue
    
    # Pattern 2
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    match2 = emptyPattern.search(modifiedXml)
    
    if match2:
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        results[cellRef] = 'P2_EMPTY'
        print(f"{cellRef}: Pattern 2 - Replaced empty cell")
        continue
    
    # Pattern 3
    if f'<c r="{cellRef}"' not in modifiedXml:
        rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
        rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
        
        if rowPattern.search(modifiedXml):
            modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
            results[cellRef] = 'P3_INSERTED'
            print(f"{cellRef}: Pattern 3 - Inserted into row {rowNum}")
            continue
        else:
            results[cellRef] = 'NO_ROW'
            print(f"{cellRef}: ERROR - Row {rowNum} not found!")
            continue
    
    results[cellRef] = 'FAILED'
    print(f"{cellRef}: FAILED - No pattern matched")

# Final check
print("\n" + "="*60)
print("FINAL VERIFICATION:\n")

for cellRef in cellsToUpdate:
    present = f'<c r="{cellRef}"' in modifiedXml
    result_type = results.get(cellRef, '?')
    status = "✓" if present else "✗"
    print(f"{status} {cellRef}: {result_type:15} Present: {present}")

total_present = sum(1 for cellRef in cellsToUpdate if f'<c r="{cellRef}"' in modifiedXml)
print(f"\nTotal: {total_present}/{len(cellsToUpdate)} cells present")
