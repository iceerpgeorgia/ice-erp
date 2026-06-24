#!/usr/bin/env python3
"""Simulate the export process and show the actual output"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

# Load template
with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

print("=== SIMULATING PLACEHOLDER CELL UPDATES ===\n")

# Simulate the placeholder data from the API
placeholder_data = {
    'A1': 'Project_Department',
    'B1': 'Tbilisi Office',
    'A2': 'Handover_Date',
    'B2': 44719,  # Excel serial for a date
    'A3': 'Project_Counteragent_Entity_Type',
    'B3': 'LLC',
    'A4': 'Project_Counteragent_Name',
    'B4': 'Test Company LLC',
    'A5': 'Project_Counteragent_Director_Genitive',
    'B5': 'იოანე გიორგაძის',
    'A6': 'Project_Counteragent_Director',
    'B6': 'იოანე გიორგაძე',
    'A7': 'Project_Counteragent_Address_Line_1',
    'B7': 'Rustaveli Ave 12',
    'A8': 'Project_Counteragent_Address_Line_2',
    'B8': 'Tbilisi 0108',
    'A9': 'Project_Counteragent_ID',
    'B9': '123456789',
    'A10': 'Project_Address',
    'B10': 'Project Location',
    'A11': 'Project_Insider_Entity_Type',
    'B11': 'LLC',
    'A12': 'Project_Insider_Name',
    'B12': 'Inside Company',
    'A13': 'Project_Insider_ID',
    'B13': '987654321',
    'A14': 'Project_Insider_Address_Line1',
    'B14': 'Address 1',
    'A15': 'Project_Insider_Address_Line2',
    'B15': 'Address 2',
    'A16': 'Project_Insider_Director_Genitive',
    'B16': 'მაია ბერძენიშვილის',
    'A17': 'Project_Insider_Director',
    'B17': 'მაია ბერძენიშვილი',
    'A18': 'Contract_Date',
    'B18': 44719,
    'A19': 'Project_Currency',
    'B19': 'GEL',
}

modifiedXml = sheet2_xml
updates_made = {}

# Simulate the update loop from API
for cellRef, value in placeholder_data.items():
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
    
    # Pattern 1: Replace existing cell
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    if cellPattern.search(modifiedXml):
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        updates_made[cellRef] = 'REPLACED (Pattern 1)'
        continue
    
    # Pattern 2: Replace self-closing empty cell
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    if emptyPattern.search(modifiedXml):
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        updates_made[cellRef] = 'REPLACED (Pattern 2)'
        continue
    
    # Pattern 3: Insert in existing row if cell doesn't exist
    if f'<c r="{cellRef}"' not in modifiedXml:
        rowNum = int(re.match(r'[A-Z]+(\d+)', cellRef).group(1))
        rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
        
        if rowPattern.search(modifiedXml):
            modifiedXml = rowPattern.sub(f'$1{cellContent}', modifiedXml)
            updates_made[cellRef] = 'INSERTED (Pattern 3)'
            continue
    
    updates_made[cellRef] = 'NOT UPDATED'

print("Update results:")
for cellRef in sorted(placeholder_data.keys()):
    status = updates_made.get(cellRef, 'UNKNOWN')
    print(f"  {cellRef}: {status}")

# Check final state
print("\n" + "="*60)
print("FINAL STATE IN MODIFIED XML:")

# Count B cells again
b_cells_final = re.findall(r'<c r="(B\d+)"', modifiedXml)
b_cells_final = sorted(set(b_cells_final))

print(f"\nB column cells in final XML: {len(b_cells_final)}")
print(f"Cells: {b_cells_final}")

# Show if values were populated
print("\n" + "="*60)
print("Sample cells from modified XML:")

for cell_ref in ['B1', 'B2', 'B5', 'B10']:
    match = re.search(f'<c r="{cell_ref}"[^>]*>(.*?)</c>', modifiedXml, re.DOTALL)
    if match:
        cell_content = match.group(1)
        # Extract value
        value_match = re.search(r'<v>([^<]*)</v>|<t>([^<]*)</t>', cell_content)
        if value_match:
            value = value_match.group(1) or value_match.group(2)
            print(f"✓ {cell_ref}: {value[:60]}")
        else:
            print(f"✗ {cell_ref}: (empty)")
    else:
        print(f"✗ {cell_ref}: (NOT FOUND)")
