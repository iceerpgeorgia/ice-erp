#!/usr/bin/env python3
"""Test the export logic directly to see what's actually happening"""

import zipfile
import re
from pathlib import Path

# Load the template
template_path = Path('public/Handover Tamplate New.xlsx')
print(f"📁 Loading template: {template_path}")
print(f"   Size: {template_path.stat().st_size} bytes\n")

with zipfile.ZipFile(template_path, 'r') as z:
    # Get sheet1.xml
    sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    print("=== BEFORE: Cached values in sheet1.xml ===")
    v_tags_before = len(re.findall(r'<v>', sheet1_xml))
    f_tags = len(re.findall(r'<f>', sheet1_xml))
    print(f"Formulas <f>: {f_tags}")
    print(f"Cached values <v>: {v_tags_before}")
    
    # Show a sample formula cell with cached value
    print("\n📝 Sample formula cell (BEFORE clearing cache):")
    formula_with_v = re.search(r'<c r="C1"[^>]*>.*?<f>.*?</f>.*?<v>.*?</v>.*?</c>', sheet1_xml, re.DOTALL)
    if formula_with_v:
        print(formula_with_v.group()[:200])
    
    # Now apply the fix: remove cached <v> elements from formula cells
    print("\n🔧 Applying fix: removing cached <v> values...")
    clearCachePattern = r'(<c[^>]*>.*?<f>.*?<\/f>)(\s*<v>.*?<\/v>)'
    sheet1_modified = re.sub(clearCachePattern, r'\1', sheet1_xml, flags=re.DOTALL)
    
    v_tags_after = len(re.findall(r'<v>', sheet1_modified))
    print(f"\n=== AFTER: Cached values removed ===")
    print(f"Formulas <f>: {f_tags} (unchanged)")
    print(f"Cached values <v>: {v_tags_after}")
    print(f"Removed: {v_tags_before - v_tags_after} <v> elements")
    
    # Show the same cell after fix
    print("\n📝 Same formula cell (AFTER clearing cache):")
    formula_after = re.search(r'<c r="C1"[^>]*>.*?<f>.*?</f>.*?</c>', sheet1_modified, re.DOTALL)
    if formula_after:
        print(formula_after.group()[:200])
    
    # Now check Placeholders sheet
    print("\n\n=== PLACEHOLDERS SHEET (sheet2.xml) ===")
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    # Find all B column cells
    b_cells = re.findall(r'<c r="(B\d+)"[^>]*>(.*?)</c>', sheet2_xml, re.DOTALL)
    print(f"B column cells in Placeholders sheet: {len(b_cells)}")
    for cell_ref, cell_content in b_cells:
        # Extract value
        value_match = re.search(r'<v>([^<]*)</v>', cell_content)
        if value_match:
            value = value_match.group(1)
            print(f"  {cell_ref}: {value[:50]}")
        else:
            print(f"  {cell_ref}: (empty)")

print("\n✅ Analysis complete!")
