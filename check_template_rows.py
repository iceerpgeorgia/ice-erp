#!/usr/bin/env python3
"""Check which rows exist in Placeholders sheet"""
import zipfile
import re

with zipfile.ZipFile('public/Handover Tamplate New.xlsx', 'r') as z:
    xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    # Find all row elements
    rows = re.findall(r'<row r="(\d+)"', xml)
    rows = sorted(set(int(r) for r in rows))
    
    print("Template Analysis:")
    print("="*80)
    print()
    print(f"Rows that exist in Placeholders sheet: {rows}")
    print()
    print(f"Expected rows for A1-B19: {list(range(1, 20))}")
    print()
    
    missing = set(range(1, 20)) - set(rows)
    if missing:
        print(f"⚠️  Missing rows: {sorted(missing)}")
    else:
        print("✓ All rows 1-19 present")
    
    print()
    print("Cell mapping in template:")
    print("-"*80)
    
    # Find all cells in each existing row
    for row_num in rows:
        # Find cells in this row
        row_pattern = f'<row r="{row_num}"[^>]*>(.*?)</row>'
        row_match = re.search(row_pattern, xml, re.DOTALL)
        if row_match:
            cells_in_row = re.findall(r'<c r="([A-Z]\d+)"', row_match.group(1))
            print(f"Row {row_num:2}: {sorted(set(cells_in_row))}")
    
    print()
    print("Issue Identification:")
    print("-"*80)
    
    # Check if any rows are missing AND if cells in existing rows match expected pattern
    expected_pairs = [(f'A{i}', f'B{i}') for i in range(1, 20)]
    
    missing_pairs = []
    for a_cell, b_cell in expected_pairs:
        if a_cell not in str(rows) or b_cell not in xml:
            row_num = int(a_cell[1:])
            if row_num not in rows:
                missing_pairs.append((a_cell, b_cell, f"Row {row_num} missing"))
            elif f'r="{a_cell}"' not in xml:
                missing_pairs.append((a_cell, b_cell, f"{a_cell} missing from row"))
            elif f'r="{b_cell}"' not in xml:
                missing_pairs.append((a_cell, b_cell, f"{b_cell} missing from row"))
    
    if missing_pairs:
        print(f"⚠️  Missing or incomplete placeholder pairs:")
        for a_cell, b_cell, reason in missing_pairs:
            print(f"  - {a_cell}/{b_cell}: {reason}")
    else:
        print("✓ All placeholder pairs seem present")
