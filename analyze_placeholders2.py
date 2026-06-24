#!/usr/bin/env python3
"""Extract Placeholders sheet content using regex"""
import zipfile
import re
from pathlib import Path

template_path = Path('public/Handover Tamplate New.xlsx')

with zipfile.ZipFile(template_path, 'r') as xlsx:
    sheet2_xml = xlsx.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("📋 Placeholders Sheet (sheet2.xml) - Regex analysis")
    print("="*80)
    print()
    
    # Extract all cell references and their content using regex
    # Pattern: <c r="CELLREF"...>...(value or formula)...</c>
    cell_pattern = r'<c r="([AB]\d+)"[^>]*>(.*?)</c>'
    cells = re.findall(cell_pattern, sheet2_xml, re.DOTALL)
    
    print(f"Total cells found: {len(cells)}")
    print()
    
    cell_dict = {}
    for ref, content in cells:
        # Extract value from <v>, <t>, or <is><t>...</t></is>
        value_match = re.search(r'<v>([^<]*)</v>', content)
        if value_match:
            value = value_match.group(1)
        else:
            text_match = re.search(r'<t>([^<]*)</t>', content)
            value = text_match.group(1) if text_match else '(no value)'
        
        cell_dict[ref] = value
    
    # Sort and display
    print("Cell Contents:")
    print("-"*80)
    
    # Sort by row
    def sort_key(ref):
        row = int(''.join(c for c in ref[1:]))
        col = ref[0]
        return (row, col)
    
    for ref in sorted(cell_dict.keys(), key=sort_key):
        value = cell_dict[ref]
        # Limit display width
        val_display = value[:60] if len(value) <= 60 else value[:57] + '...'
        print(f"  {ref:5} : {val_display}")
    
    print()
    print("="*80)
    
    # Analyze structure
    a_cells = {k: v for k, v in cell_dict.items() if k.startswith('A')}
    b_cells = {k: v for k, v in cell_dict.items() if k.startswith('B')}
    
    print(f"Column A (Labels): {len(a_cells)} cells")
    print(f"Column B (Values): {len(b_cells)} cells")
    print()
    
    # Show which rows have A but no B
    a_rows = set(int(k[1:]) for k in a_cells.keys())
    b_rows = set(int(k[1:]) for k in b_cells.keys())
    
    missing_b = a_rows - b_rows
    if missing_b:
        print(f"⚠️  ISSUE FOUND: {len(missing_b)} rows have Column A but NO Column B!")
        print(f"  Rows with missing B: {sorted(missing_b)}")
    
    print()
    print("💡 Analysis:")
    if len(a_cells) >= 19 and len(b_cells) < 19:
        print("  ✗ Placeholders sheet has A column labels but missing B column values")
        print("  ✗ VLOOKUP formulas will return #N/A or blank")
    elif len(b_cells) == 0:
        print("  ✗ Placeholders sheet has NO value cells at all")
        print("  ✗ All VLOOKUP formulas will fail")
    else:
        print("  ✓ Placeholders sheet structure looks correct")
