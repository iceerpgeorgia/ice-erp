import zipfile
import xml.etree.ElementTree as ET

print('=' * 70)
print('INSPECTING EXPORTED HANDOVER FILE: handover_export_main.xlsx')
print('=' * 70)

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        # Extract sheet2.xml (Placeholders sheet)
        print('\n📋 Reading Placeholders sheet (sheet2.xml)...')
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        # Parse XML
        root = ET.fromstring(content)
        
        # Namespace for Excel XML
        ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        # Count all cells with values
        all_cells = {}
        for elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            r_attr = elem.get('r')
            if r_attr:
                # Check if has value child
                v_elem = elem.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                if v_elem is not None:
                    all_cells[r_attr] = v_elem.text
        
        # Filter B-column cells
        b_cells = {k: v for k, v in all_cells.items() if k.startswith('B')}
        b_cells_sorted = sorted(b_cells.keys(), key=lambda x: int(x[1:]))
        
        print(f'\n✅ PLACEHOLDERS SHEET ANALYSIS:')
        print(f'   Total B-column cells: {len(b_cells_sorted)}')
        print(f'   Cells: {", ".join(b_cells_sorted)}')
        
        if len(b_cells_sorted) >= 19:
            print(f'   ✅ SUCCESS! All 19 cells present (got {len(b_cells_sorted)})')
        else:
            print(f'   ❌ ISSUE! Expected 19, got {len(b_cells_sorted)}')
        
        # Show content
        print(f'\n📝 PLACEHOLDER CELLS CONTENT:')
        for i, cell_ref in enumerate(b_cells_sorted[:20], 1):
            val = b_cells[cell_ref][:40] if b_cells[cell_ref] else '(empty)'
            print(f'   {cell_ref}: {val}')
        
        # Verify formulas in sheet1
        print(f'\n📋 CHECKING HANDOVER SHEET (sheet1.xml):')
        with z.open('xl/worksheets/sheet1.xml') as f:
            sheet1_content = f.read().decode('utf-8')
        
        formula_count = sheet1_content.count('<f>')
        vlookup_count = sheet1_content.count('VLOOKUP')
        
        print(f'   Formulas found: {formula_count}')
        print(f'   VLOOKUP formulas: {vlookup_count}')
        
        if vlookup_count > 0:
            print(f'   ✅ VLOOKUP formulas present and ready to resolve')
        
        print(f'\n{'='*70}')
        print('✅ EXPORT VERIFICATION COMPLETE')
        print('='*70)
        
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
