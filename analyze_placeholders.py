#!/usr/bin/env python3
"""Extract detailed Placeholders sheet content"""
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

template_path = Path('public/Handover Tamplate New.xlsx')

with zipfile.ZipFile(template_path, 'r') as xlsx:
    sheet2_xml = xlsx.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("📋 Placeholders Sheet (sheet2.xml) - Raw XML analysis")
    print("="*80)
    
    # Parse XML properly
    root = ET.fromstring(sheet2_xml)
    ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    # Find all cells
    cells = root.findall('.//c', ns) if root.tag.endswith('worksheet') else []
    
    # Also try without namespace
    cells = root.findall('.//c')
    
    print(f"Total cells found: {len(cells)}")
    print()
    
    # Group by column
    cell_dict = {}
    for cell in cells:
        ref = cell.get('r')  # e.g., "A1", "B1"
        col = ref[0] if ref else None
        
        # Get cell value
        value = None
        # Try to find <v> or <t> elements
        v_elem = cell.find('.//v')
        if v_elem is not None and v_elem.text:
            value = v_elem.text
        else:
            # Try <is><t>value</t></is> format
            t_elem = cell.find('.//t')
            if t_elem is not None and t_elem.text:
                value = t_elem.text
        
        if ref not in cell_dict:
            cell_dict[ref] = value
    
    # Display cells in order
    print("Cell Contents (in spreadsheet order):")
    print("-"*80)
    
    # Sort by column then row
    def sort_key(ref):
        col = ref[0]
        row = int(''.join(c for c in ref[1:]))
        return (col, row)
    
    for ref in sorted(cell_dict.keys(), key=sort_key):
        value = cell_dict[ref]
        print(f"{ref:6} = {value if value else '(empty)'}")
    
    print()
    print("="*80)
    print("Analysis:")
    print("-"*80)
    
    a_cells = [ref for ref in cell_dict if ref.startswith('A')]
    b_cells = [ref for ref in cell_dict if ref.startswith('B')]
    
    print(f"Column A (Labels): {len(a_cells)} cells")
    for ref in sorted(a_cells, key=lambda x: int(x[1:])):
        value = cell_dict[ref]
        print(f"  {ref}: {value}")
    
    print()
    print(f"Column B (Values): {len(b_cells)} cells")
    for ref in sorted(b_cells, key=lambda x: int(x[1:])):
        value = cell_dict[ref]
        val_str = str(value) if value else '(EMPTY)'
        print(f"  {ref}: {val_str}")
    
    print()
    print("🔍 Issue Identified:")
    print(f"  - Column A has {len(a_cells)} label cells (should be ~19)")
    print(f"  - Column B has {len(b_cells)} value cells (should be ~19)")
    print(f"  - MISMATCH: {len(a_cells) - len(b_cells)} cells missing in Column B!")
    print()
    print("💡 Root Cause:")
    print("  The Placeholders sheet is missing B column cells.")
    print("  VLOOKUP formulas in sheet1 look for labels in Column A,")
    print("  then try to return values from Column B, but most B cells don't exist.")
    print("  This causes the formulas to return blank or #N/A.")
