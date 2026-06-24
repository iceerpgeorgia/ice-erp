import zipfile

print('Checking actual cell XML in template...\n')

try:
    with zipfile.ZipFile('public/Handover Tamplate New.xlsx', 'r') as z:
        with z.open('xl/worksheets/sheet2.xml') as f:
            content = f.read().decode('utf-8')
        
        # Find B cells and show their exact XML
        for cell_ref in ['B2', 'B5', 'B9', 'B16', 'B18']:
            # Find the cell tag for this reference
            import re
            pattern = rf'<c r="{cell_ref}"[^>]*>.*?</c>'
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                cell_xml = match.group(0)
                print(f'{cell_ref}: {cell_xml[:100]}...')
            else:
                print(f'{cell_ref}: NOT FOUND')
        
        # Also check for empty/self-closing cells
        print('\n\nLooking for self-closing cells:')
        for cell_ref in ['B3', 'B4', 'B6', 'B7']:
            pattern = rf'<c r="{cell_ref}"[^>]*/>'
            if re.search(pattern, content):
                match = re.search(pattern, content)
                print(f'{cell_ref}: {match.group(0)}')
            else:
                # Check if row exists but cell doesn't
                row_num = cell_ref[1:]
                if f'<row r="{row_num}"' in content:
                    print(f'{cell_ref}: Row {row_num} exists but NO B cell in it')
                else:
                    print(f'{cell_ref}: Row {row_num} does not exist')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
