import zipfile
import xml.etree.ElementTree as ET

print('Checking TEMPLATE file (not export)...\n')

try:
    # Load the template from the public folder
    with zipfile.ZipFile('public/Handover Tamplate New.xlsx', 'r') as z:
        # Extract sheet2.xml
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        # Parse XML
        root = ET.fromstring(content)
        
        # Count rows
        rows = []
        for elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            r_attr = elem.get('r')
            if r_attr:
                rows.append(int(r_attr))
        
        print(f'TEMPLATE SHEET2.XML:')
        print(f'  Total rows: {len(rows)}')
        print(f'  Row numbers: {sorted(rows)}')
        
        # Count B cells
        b_cells = []
        for elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            r_attr = elem.get('r')
            if r_attr and r_attr.startswith('B'):
                b_cells.append(r_attr)
        
        print(f'\n  B-column cells in template: {len(b_cells)}')
        print(f'  Cell refs: {sorted(b_cells)}')
        
        # Check content
        print(f'\n  XML content preview (first 1000 chars):')
        print(f'  {content[:1000]}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
