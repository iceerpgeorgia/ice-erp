import zipfile
import xml.etree.ElementTree as ET

print('CHECKING BOTH A AND B COLUMNS...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        root = ET.fromstring(content)
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        
        # Get ALL cells (A and B) with their content
        all_cells = {}
        
        for elem in root.iter(f'{ns}c'):
            r_attr = elem.get('r')
            if r_attr:
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
                
                all_cells[r_attr] = value
        
        # Display by row
        print('PLACEHOLDERS LOOKUP TABLE (for VLOOKUP):')
        print('Row | A-Column (Label)                         | B-Column (Value)')
        print('----|------------------------------------------|-----------------------------------------')
        
        for row in range(1, 20):
            a_cell = f'A{row}'
            b_cell = f'B{row}'
            
            a_val = all_cells.get(a_cell, '(missing)')
            b_val = all_cells.get(b_cell, '(missing)')
            
            a_display = str(a_val)[:40] if a_val else '(empty)'
            b_display = str(b_val)[:40] if b_val else '(empty)'
            
            print(f'{row:3} | {a_display:40} | {b_display}')
        
        # Check for VLOOKUP formulas
        print('\n\nCHECKING FORMULAS IN HANDOVER SHEET...')
        with z.open('xl/worksheets/sheet1.xml') as f:
            sheet1_content = f.read().decode('utf-8')
        
        import re
        # Find all VLOOKUP formulas
        formulas = re.findall(r'<f>([^<]*VLOOKUP[^<]*)</f>', sheet1_content)
        
        print(f'Found {len(formulas)} VLOOKUP formulas:')
        for i, formula in enumerate(formulas[:5], 1):
            print(f'  {i}. {formula[:100]}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
