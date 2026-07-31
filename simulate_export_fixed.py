#!/usr/bin/env python3
"""Fixed simulation with correct regex replacement"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

# Load template
with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

print("=== CORRECTED SIMULATION ===\n")

# Simulate placeholder data
placeholder_data = {
    'B1': 'Tbilisi Office',
    'B2': '44719',
    'B3': 'LLC',
    'B4': 'Test Company',
    'B5': 'იოანე გ-ის',
    'B6': 'იოანე გ.',
    'B10': 'Test Address',
    'B17': 'Director Name',
    'B19': 'GEL',
}

modifiedXml = sheet2_xml
updates_made = {}

for cellRef, value in placeholder_data.items():
    stringValue = str(value)
    
    isDateCell = cellRef in ['B2']
    
    escapedValue = stringValue
    escapedValue = escapedValue.replace('&', '&amp;')
    escapedValue = escapedValue.replace('<', '&lt;')
    escapedValue = escapedValue.replace('>', '&gt;')
    
    if isDateCell:
        cellContent = f'<c r="{cellRef}" t="n"><v>{escapedValue}</v></c>'
    else:
        cellContent = f'<c r="{cellRef}"><is><t>{escapedValue}</t></is></c>'
    
    updated = False
    
    # Pattern 1: Replace existing cell
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    if cellPattern.search(modifiedXml):
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        updates_made[cellRef] = 'REPLACED (Pattern 1)'
        updated = True
    
    # Pattern 2: Replace self-closing empty cell
    if not updated:
        emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
        if emptyPattern.search(modifiedXml):
            modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
            updates_made[cellRef] = 'REPLACED (Pattern 2)'
            updated = True
    
    # Pattern 3: Insert in existing row if cell doesn't exist  
    if not updated:
        rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
        rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
        
        if rowPattern.search(modifiedXml):
            # FIXED: Use \1 not $1 for Python regex
            modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
            updates_made[cellRef] = 'INSERTED (Pattern 3)'
            updated = True
    
    if not updated:
        updates_made[cellRef] = 'FAILED'

print("Update results:")
for cellRef in sorted(placeholder_data.keys()):
    status = updates_made.get(cellRef, 'NOT PROCESSED')
    print(f"  {cellRef}: {status}")

# Verify all cells are now present
print("\n" + "="*60)
print("Verification in final XML:")

all_present = True
for cellRef in placeholder_data.keys():
    if f'<c r="{cellRef}"' in modifiedXml:
        print(f"✓ {cellRef}: FOUND")
    else:
        print(f"✗ {cellRef}: MISSING")
        all_present = False

if all_present:
    print("\n✅ SUCCESS - All placeholder cells are present!")
else:
    print("\n❌ FAILURE - Some cells are still missing!")
