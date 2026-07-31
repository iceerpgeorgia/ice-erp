#!/usr/bin/env python3
"""Dump the exact XML for a specific formula cell"""

import zipfile
import re

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Find cell D1 (which has a formula with cached value)
    print("=== CELL D1 EXACT XML ===\n")
    match = re.search(r'(<c r="D1"[^>]*>.*?</c>)', sheet1_xml, re.DOTALL)
    if match:
        cell_xml = match.group(1)
        print(cell_xml[:500])
        print("\n...")
        print(cell_xml[-500:])
    
    # Find cell J16 (which also has a formula and cached value)
    print("\n\n=== CELL J16 EXACT XML ===\n")
    match = re.search(r'(<c r="J16"[^>]*>.*?</c>)', sheet1_xml, re.DOTALL)
    if match:
        cell_xml = match.group(1)
        print(cell_xml)
