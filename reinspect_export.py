import zipfile
import xml.etree.ElementTree as ET

print('RE-INSPECTING with CORRECT VALUE extraction...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        root = ET.fromstring(content)
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        
        # Get ALL B cells with their content
        b_cells_with_values = {}
        
        for elem in root.iter(f'{ns}c'):
            r_attr = elem.get('r')
            if r_attr and r_attr.startswith('B'):
                # Check for value in different formats
                v_elem = elem.find(f'{ns}v')  # Numeric value
                is_elem = elem.find(f'{ns}is')  # Inline string
                t_elem = elem.find(f'{ns}t')  # Direct text child
                
                value = None
                if v_elem is not None:
                    value = v_elem.text
                elif is_elem is not None:
                    t_sub = is_elem.find(f'{ns}t')
                    if t_sub is not None:
                        value = t_sub.text
                elif t_elem is not None:
                    value = t_elem.text
                
                b_cells_with_values[r_attr] = value
        
        # Sort and display
        sorted_cells = sorted(b_cells_with_values.keys(), key=lambda x: int(x[1:]))
        
        print('B-COLUMN CELLS WITH VALUES:')
        populated = 0
        for cell_ref in sorted_cells:
            val = b_cells_with_values[cell_ref]
            if val:
                populated += 1
                display = str(val)[:60]
                print(f'  ✓ {cell_ref:3}: {display}')
            else:
                print(f'  ✗ {cell_ref:3}: EMPTY')
        
        print(f'\n✅ TOTAL POPULATED: {populated}/19')
        
        if populated == 19:
            print('\n🎉 SUCCESS! All 19 cells have values!')
        else:
            print(f'\n⚠️ Only {populated}/19 cells populated')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
