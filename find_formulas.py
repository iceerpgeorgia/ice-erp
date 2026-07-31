#!/usr/bin/env python3
"""Find the actual formula cells with <f> tags"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Find all cells with <f> tags (formulas)
    print("=== ACTUAL FORMULA CELLS (with <f> tags) ===\n")
    
    formula_cells = re.finditer(r'<c r="([A-Z]+\d+)"[^>]*>(.*?)</c>', sheet1_xml, re.DOTALL)
    
    count = 0
    for match in formula_cells:
        cell_ref = match.group(1)
        cell_content = match.group(2)
        
        if '<f>' in cell_content:  # Only show cells with formulas
            count += 1
            print(f"{count}. Cell {cell_ref}:")
            
            # Extract formula
            formula_match = re.search(r'<f>(.*?)</f>', cell_content, re.DOTALL)
            if formula_match:
                formula = formula_match.group(1)[:80]
                print(f"   Formula: {formula}")
            
            # Check for <v> cached value
            v_match = re.search(r'<v>([^<]*)</v>', cell_content)
            if v_match:
                value = v_match.group(1)
                print(f"   Cached <v>: {value}")
            else:
                print(f"   Cached <v>: (none)")
            
            # Show the full cell XML
            print(f"   Full XML: {cell_content[:150]}...")
            print()
