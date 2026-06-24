#!/usr/bin/env python3
"""Trace exactly where the problem first appears"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

modifiedXml = sheet2_xml

# Process in order and check where rows disappear
ops = [
    ('B1', 'P3', 1),  # Insert into row 1
    ('B2', 'P1', 2),  # Replace row 2
    ('B3', 'P3', 3),  # Insert into row 3
    ('B4', 'P3', 4),  # Insert into row 4  
]

rows_to_monitor = [1, 2, 3, 4, 5, 6, 10]

print("Monitoring rows after each operation:\n")

for i, (cellRef, op_type, row_num) in enumerate(ops):
    cellContent = f'<c r="{cellRef}"><is><t>Val_{cellRef}</t></is></c>'
    
    # Apply the operation
    if op_type == 'P1':
        cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
        modifiedXml = cellPattern.sub(cellContent, modifiedXml)
        print(f"{i+1}. {cellRef} ({op_type}): Replaced")
    elif op_type == 'P3':
        rowPattern = re.compile(f'(<row r="{row_num}"[^>]*>)')
        modifiedXml = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
        print(f"{i+1}. {cellRef} ({op_type}): Inserted into row {row_num}")
    
    # Check all monitored rows
    rows_found = []
    rows_not_found = []
    for check_row in rows_to_monitor:
        if f'<row r="{check_row}"' in modifiedXml:
            rows_found.append(check_row)
        else:
            rows_not_found.append(check_row)
    
    if rows_not_found:
        print(f"   ⚠ MISSING ROWS: {rows_not_found}")
    else:
        print(f"   ✓ All rows {rows_to_monitor} still present")
    
    # Check XML integrity
    row_tags = len(re.findall(r'<row', modifiedXml))
    row_close = len(re.findall(r'</row>', modifiedXml))
    if row_tags != row_close:
        print(f"   ✗ XML BROKEN: {row_tags} <row> but {row_close} </row>!")

print("\n" + "="*60)
print("\nLet me try a DIFFERENT approach - maybe the issue is with how I'm storing the XML...")
print("\nUsing list instead of string reassignment:\n")

# Start over with a list approach
with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')

modifiedXml = sheet2_xml

for i, (cellRef, op_type, row_num) in enumerate(ops):
    cellContent = f'<c r="{cellRef}"><is><t>Val_{cellRef}</t></is></c>'
    
    print(f"{i+1}. Before {cellRef}: Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml))}")
    
    if op_type == 'P1':
        cellPattern = re.compile(f'<c r="{cellRef}"[^>]*>.*?</c>', re.DOTALL)
        result = cellPattern.sub(cellContent, modifiedXml)
        modifiedXml = result
    elif op_type == 'P3':
        rowPattern = re.compile(f'(<row r="{row_num}"[^>]*>)')
        result = rowPattern.sub(f'\\1{cellContent}', modifiedXml)
        modifiedXml = result
    
    print(f"   After {cellRef}: Row 3 found: {bool(re.search(r'<row r=\"3\"', modifiedXml))}")
