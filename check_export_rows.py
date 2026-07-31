import zipfile
import xml.etree.ElementTree as ET

print('Checking EXPORTED file rows...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        root = ET.fromstring(content)
        
        # Count rows
        rows = []
        for elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            r_attr = elem.get('r')
            if r_attr:
                rows.append(int(r_attr))
        
        print(f'EXPORTED SHEET2.XML:')
        print(f'  Total rows: {len(rows)}')
        print(f'  Row numbers: {sorted(rows)}')
        print(f'  Missing rows: {[i for i in range(1, 20) if i not in rows]}')
        
        # Count all B cells
        b_cells = []
        for elem in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            r_attr = elem.get('r')
            if r_attr and r_attr.startswith('B'):
                b_cells.append(r_attr)
        
        print(f'\n  B-column cells in export: {len(b_cells)}')
        print(f'  B cells: {sorted(b_cells)}')
        print(f'  Missing B cells (should be 1-19): {[f"B{i}" for i in range(1, 20) if f"B{i}" not in b_cells]}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
