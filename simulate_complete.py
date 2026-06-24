#!/usr/bin/env python3
"""Complete simulation with all 19 cells + proper escape handling"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

print("=== COMPLETE SIMULATION - ALL 19 CELLS ===\n")

# All placeholder data from API
placeholder_data = {
    'A1': 'Project_Department',
    'B1': 'Tbilisi',
    'A2': 'Handover_Date',
    'B2': '44719',
    'A3': 'Project_Counteragent_Entity_Type',
    'B3': 'LLC',
    'A4': 'Project_Counteragent_Name',
    'B4': 'Test Co',
    'A5': 'Project_Counteragent_Director_Genitive',
    'B5': 'იოანე ბ.',
    'A6': 'Project_Counteragent_Director',
    'B6': 'იოანე ბ',
    'A7': 'Address_Line_1',
    'B7': 'Street 1',
    'A8': 'Address_Line_2',
    'B8': 'City',
    'A9': 'Project_Counteragent_ID',
    'B9': '123456',
    'A10': 'Project_Address',
    'B10': 'Addr',
    'A11': 'Project_Insider_Entity_Type',
    'B11': 'LLC',
    'A12': 'Project_Insider_Name',
    'B12': 'Company',
    'A13': 'Project_Insider_ID',
    'B13': '654321',
    'A14': 'Project_Insider_Address_Line1',
    'B14': 'Addr1',
    'A15': 'Project_Insider_Address_Line2',
    'B15': 'City',
    'A16': 'Project_Insider_Director_Genitive',
    'B16': 'დ. დ.',
    'A17': 'Project_Insider_Director',
    'B17': 'დ.დ.',
    'A18': 'Contract_Date',
    'B18': '44719',
    'A19': 'Project_Currency',
    'B19': 'GEL',
}

modifiedXml = sheet2_xml
success_count = 0
fail_count = 0
updates = {}

# Process all cells
for cellRef in sorted(placeholder_data.keys()):
    value = placeholder_data[cellRef]
    stringValue = str(value)
    
    isDateCell = cellRef in ['B2', 'B18']
    
    # Escape XML
    escapedValue = stringValue
    escapedValue = escapedValue.replace('&', '&amp;')
    escapedValue = escapedValue.replace('<', '&lt;')
    escapedValue = escapedValue.replace('>', '&gt;')
    escapedValue = escapedValue.replace('"', '&quot;')
    escapedValue = escapedValue.replace("'", '&apos;')
    
    if isDateCell:
        cellContent = f'<c r="{cellRef}" t="n"><v>{escapedValue}</v></c>'
    else:
        cellContent = f'<c r="{cellRef}"><is><t>{escapedValue}</t></is></c>'
    
    updated = False
    
    # Pattern 1: Replace existing cell
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    if cellPattern.search(modifiedXml):
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        updates[cellRef] = 'REPLACED'
        success_count += 1
        updated = True
        continue
    
    # Pattern 2: Replace self-closing empty cell
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    if emptyPattern.search(modifiedXml):
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        updates[cellRef] = 'EMPTY_REPLACED'
        success_count += 1
        updated = True
        continue
    
    # Pattern 3: Insert in existing row if cell doesn't exist
    if not updated and f'<c r="{cellRef}"' not in modifiedXml:
        rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
        rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
        
        if rowPattern.search(modifiedXml):
            modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
            updates[cellRef] = 'INSERTED'
            success_count += 1
            updated = True
            continue
    
    if not updated:
        updates[cellRef] = 'FAILED'
        fail_count += 1

# Print results
print(f"Results: {success_count} successful, {fail_count} failed\n")

# Show by pattern
replaced = [k for k,v in updates.items() if v == 'REPLACED']
inserted = [k for k,v in updates.items() if v == 'INSERTED']
failed = [k for k,v in updates.items() if v == 'FAILED']

if replaced:
    print(f"REPLACED ({len(replaced)}): {replaced}")
if inserted:
    print(f"INSERTED ({len(inserted)}): {inserted}")
if failed:
    print(f"FAILED ({len(failed)}): {failed}")

# Verify all B cells are present
print("\n" + "="*60)
print("B Column Verification:")

all_b_cells = [k for k in placeholder_data.keys() if k.startswith('B')]
present_count = 0
missing_count = 0

for cell in all_b_cells:
    if f'<c r="{cell}"' in modifiedXml:
        present_count += 1
    else:
        print(f"  ✗ {cell}: MISSING")
        missing_count += 1

print(f"\nB cells present: {present_count}/{len(all_b_cells)}")
if missing_count == 0:
    print("✅ ALL B CELLS PRESENT")
else:
    print(f"❌ {missing_count} B CELLS MISSING")
