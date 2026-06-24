#!/usr/bin/env python3
"""Check which rows exist in Placeholders sheet"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    # Find all rows
    rows = re.findall(r'<row r="(\d+)"', sheet2_xml)
    rows = sorted(set(map(int, rows)))
    
    print("Rows that exist in Placeholders sheet:")
    print(rows)
    print(f"\nTotal rows: {len(rows)}")
    
    print("\n" + "="*60)
    print("Expected rows for 19 placeholders: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]")
    print("\nMissing rows:")
    expected_rows = set(range(1, 20))
    actual_rows = set(rows)
    missing = expected_rows - actual_rows
    if missing:
        print(sorted(missing))
    else:
        print("(none - all rows exist)")
    
    # Now check which B cells actually exist
    print("\n" + "="*60)
    print("B column cells that exist:")
    b_cells = re.findall(r'<c r="(B\d+)"', sheet2_xml)
    b_cells = sorted(set(b_cells))
    print(b_cells)
    
    print("\nExpected B column cells: B1 through B19")
    print(f"Actual B column cells: {len(b_cells)} cells")
    
    missing_b = []
    for i in range(1, 20):
        if f'B{i}' not in b_cells:
            missing_b.append(f'B{i}')
    
    if missing_b:
        print(f"\nMissing B cells ({len(missing_b)}):")
        print(missing_b)
