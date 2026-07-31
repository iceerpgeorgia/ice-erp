#!/usr/bin/env python3
"""Inspect the Placeholders sheet (sheet2) in detail"""

import zipfile
import re
import xml.etree.ElementTree as ET

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("=== PLACEHOLDERS SHEET (sheet2.xml) ===\n")
    print("Raw XML (first 1000 chars):")
    print(sheet2_xml[:1000])
    print("\n...\n")
    
    # Parse to see structure
    print("=== STRUCTURED VIEW ===\n")
    
    # Find all rows
    rows = re.finditer(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet2_xml, re.DOTALL)
    
    for row_match in rows:
        row_num = row_match.group(1)
        row_content = row_match.group(2)
        
        # Find all cells in this row
        cells = re.finditer(r'<c r="([A-Z]+\d+)"[^>]*>(.*?)</c>', row_content, re.DOTALL)
        
        cell_list = []
        for cell_match in cells:
            cell_ref = cell_match.group(1)
            cell_content = cell_match.group(2)
            
            # Extract value
            if '<v>' in cell_content:
                value_match = re.search(r'<v>([^<]*)</v>', cell_content)
                if value_match:
                    value = value_match.group(1)
                    cell_list.append(f"{cell_ref}='{value}'")
            else:
                # Check for inline strings
                if '<t>' in cell_content:
                    t_match = re.search(r'<t>([^<]*)</t>', cell_content)
                    if t_match:
                        value = t_match.group(1)
                        cell_list.append(f"{cell_ref}='{value}'")
                else:
                    cell_list.append(f"{cell_ref}=(empty)")
        
        if cell_list:
            print(f"Row {row_num}: {', '.join(cell_list)}")
    
    print("\n=== ANALYSIS ===\n")
    print("Expected Placeholders structure:")
    print("  Row 1: A1='Project_Department', B1=(empty)")
    print("  Row 2: A2='Handover_Date', B2=(empty)")
    print("  ... (up to Row 19)")
    print("\nActual structure found above ↑")
