import zipfile
import xml.etree.ElementTree as ET

print('EXAMINING A-COLUMN CELL DETAILS...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        # Look for A1-A5 raw XML
        import re
        for cell_ref in ['A1', 'A2', 'A3', 'A4', 'A5']:
            pattern = rf'<c r="{cell_ref}"[^>]*>.*?</c>'
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                cell_xml = match.group(0)
                print(f'{cell_ref}:')
                print(f'  {cell_xml}')
                
                # Check cell type
                if 't="s"' in cell_xml:
                    print(f'  Type: Shared String (t="s")')
                elif '<is>' in cell_xml:
                    print(f'  Type: Inline String (<is>)')
                else:
                    print(f'  Type: Unknown')
                print()
        
        # Check if A-column cells exist at all
        root = ET.fromstring(content)
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        
        a_cells_in_xml = []
        for elem in root.iter(f'{ns}c'):
            r_attr = elem.get('r')
            if r_attr and r_attr.startswith('A'):
                a_cells_in_xml.append(r_attr)
        
        print(f'A-cells found in XML: {sorted(a_cells_in_xml)}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
