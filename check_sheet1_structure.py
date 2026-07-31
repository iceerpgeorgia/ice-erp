import zipfile
import xml.etree.ElementTree as ET

print('CHECKING HANDOVER SHEET (sheet1.xml) STRUCTURE...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        # List all files in the ZIP
        print('Files in export:')
        for name in z.namelist():
            if 'worksheet' in name or 'sheet' in name:
                print(f'  - {name}')
        
        print('\n' + '='*70)
        
        # Check if sheet1.xml exists
        try:
            with z.open('xl/worksheets/sheet1.xml') as f:
                content = f.read().decode('utf-8')
            
            print('✓ sheet1.xml found')
            print(f'  Size: {len(content)} bytes')
            print(f'  First 500 chars:\n{content[:500]}')
            
            # Parse and check structure
            root = ET.fromstring(content)
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            
            # Count rows
            rows = list(root.iter(f'{ns}row'))
            print(f'\n  Rows: {len(rows)}')
            
            # Count cells
            cells = list(root.iter(f'{ns}c'))
            print(f'  Cells: {len(cells)}')
            
            # Count formulas
            formulas = list(root.iter(f'{ns}f'))
            print(f'  Formulas: {len(formulas)}')
            
            # Check for merged ranges
            merged = root.find(f'{ns}mergeCells')
            if merged is not None:
                merge_count = len(list(merged))
                print(f'  Merged ranges: {merge_count}')
            
        except KeyError:
            print('✗ sheet1.xml NOT FOUND')
        
        print('\n' + '='*70)
        
        # Compare with template
        print('\nCOMPARE WITH TEMPLATE:')
        with zipfile.ZipFile('public/Handover Tamplate New.xlsx', 'r') as template_z:
            with template_z.open('xl/worksheets/sheet1.xml') as f:
                template_content = f.read().decode('utf-8')
            
            print(f'Template sheet1.xml size: {len(template_content)} bytes')
            
            root = ET.fromstring(template_content)
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            
            rows = list(root.iter(f'{ns}row'))
            print(f'Template rows: {len(rows)}')
            
            cells = list(root.iter(f'{ns}c'))
            print(f'Template cells: {len(cells)}')
            
            formulas = list(root.iter(f'{ns}f'))
            print(f'Template formulas: {len(formulas)}')
        
        print(f'\n\nEXPORT vs TEMPLATE:')
        print(f'  Sheet size: {len(content)} vs {len(template_content)} bytes')
        if len(content) < len(template_content) / 2:
            print(f'  ⚠️ Export sheet is MUCH SMALLER - content may be missing!')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
