import zipfile

print('CHECKING RAW XML OF A-COLUMN CELLS...\n')

try:
    with zipfile.ZipFile('handover_export_main.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        # Find A1-A5 cells and show raw XML
        import re
        for cell_ref in ['A1', 'A2', 'A3', 'A4', 'A5']:
            pattern = rf'<c r="{cell_ref}"[^>]*>.*?</c>'
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                cell_xml = match.group(0)
                # Truncate if long
                if len(cell_xml) > 150:
                    cell_xml = cell_xml[:150] + '...'
                print(f'{cell_ref}: {cell_xml}')
            else:
                print(f'{cell_ref}: NOT FOUND')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
