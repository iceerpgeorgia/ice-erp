#!/usr/bin/env python3
"""Test full export flow with actual template"""
import zipfile
import re
from pathlib import Path

template_path = Path('public/Handover Tamplate New.xlsx')

print("Testing full export placeholder population flow")
print("="*80)
print()

# Load template
with zipfile.ZipFile(template_path, 'r') as xlsx:
    placeholders_xml = xlsx.read('xl/worksheets/sheet2.xml').decode('utf-8')

print(f"Original Placeholders sheet size: {len(placeholders_xml)} bytes")

# Simulate what the export code does
placeholder_data = {
    'A1': 'Project_Department',
    'B1': 'Test Department',
    'A2': 'Handover_Date',
    'B2': '44719',  # Excel serial date
    'A3': 'Counteragent',
    'B3': 'Test Company',
    'A4': 'Project_Name',
    'B4': 'Test Project',
    'A5': 'Currency',
    'B5': 'GEL',
}

print(f"Placeholder data to populate: {len(placeholder_data)} cells")
print()

# Track which cells get updated
updated_cells = []
unchanged_cells = []

modifiedXml = placeholders_xml

for cellRef, value in placeholder_data.items():
    stringValue = str(value)
    
    # Escape XML
    escapedValue = (stringValue
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;'))
    
    # Create cell content (use inlineStr for non-date cells)
    cellContent = f'<c r="{cellRef}"><is><t>{escapedValue}</t></is></c>'
    
    # Pattern 1: Replace existing cell completely
    cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
    if cellPattern.search(modifiedXml):
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        updated_cells.append((cellRef, 'Pattern 1 (full cell)'))
        continue
    
    # Pattern 2: Replace self-closing empty cell
    emptyPattern = re.compile(f'<c r="{cellRef}"[^>]*/>')
    if emptyPattern.search(modifiedXml):
        modifiedXml = emptyPattern.sub(cellContent, modifiedXml)
        updated_cells.append((cellRef, 'Pattern 2 (self-closing)'))
        continue
    
    # Pattern 3: Insert in existing row
    rowNum = int(''.join(c for c in cellRef[1:]))
    rowPattern = re.compile(f'(<row r="{rowNum}"[^>]*>)')
    if rowPattern.search(modifiedXml):
        modifiedXml = rowPattern.sub(f'$1{cellContent}', modifiedXml)
        updated_cells.append((cellRef, 'Pattern 3 (insert in row)'))
        continue
    
    unchanged_cells.append(cellRef)

print(f"Results:")
print(f"  ✓ Updated cells: {len(updated_cells)}")
for cell, method in updated_cells:
    print(f"    - {cell}: {method}")

if unchanged_cells:
    print(f"  ⚠️  Unchanged cells: {len(unchanged_cells)}")
    for cell in unchanged_cells:
        print(f"    - {cell}")

print()
print(f"Modified XML size: {len(modifiedXml)} bytes")
print(f"Size change: {len(modifiedXml) - len(placeholders_xml):+d} bytes")

# Verify the modifications
print()
print("Verification - checking if values are now in the XML:")
print("-"*80)

for cellRef, value in placeholder_data.items():
    if cellRef.startswith('B'):  # Check B column values
        if value in modifiedXml:
            print(f"  ✓ {cellRef} contains '{value}'")
        else:
            print(f"  ✗ {cellRef} does NOT contain '{value}'")

# Extract and show the modified cells
print()
print("Modified XML cell references (A and B columns):")
print("-"*80)

# Find A1-A5, B1-B5
for row in range(1, 6):
    a_cell = f'A{row}'
    b_cell = f'B{row}'
    
    # Find cell content
    a_pattern = re.compile(f'<c r="{a_cell}"[^>]*>(.*?)</c>', re.DOTALL)
    b_pattern = re.compile(f'<c r="{b_cell}"[^>]*>(.*?)</c>', re.DOTALL)
    
    a_match = a_pattern.search(modifiedXml)
    b_match = b_pattern.search(modifiedXml)
    
    a_content = a_match.group(1)[:50] if a_match else '(empty)'
    b_content = b_match.group(1)[:50] if b_match else '(empty)'
    
    print(f"  Row {row}: A='{a_content}' | B='{b_content}'")
