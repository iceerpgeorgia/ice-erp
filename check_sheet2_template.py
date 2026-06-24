import zipfile

# Extract sheet2.xml from template
template_path = 'public/Handover Tamplate New.xlsx'
with zipfile.ZipFile(template_path, 'r') as z:
    xml_str = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print('=== TEMPLATE SHEET2.XML ANALYSIS ===\n')
    print(f'Size: {len(xml_str)} bytes')
    print(f'Contains rows: {xml_str.count("<row")}')
    print(f'Contains cells: {xml_str.count("<c ")}')
    print()
    
    # Look for A-column cells
    print('Looking for A-column cells (A1-A19):')
    for i in range(1, 20):
        cell_ref = f'A{i}'
        if f'r="{cell_ref}"' in xml_str:
            # Find the cell
            idx = xml_str.find(f'r="{cell_ref}"')
            start = xml_str.rfind('<c', 0, idx)
            end = xml_str.find('</c>', idx) + 4
            cell_xml = xml_str[start:end]
            print(f'{cell_ref}: {cell_xml[:80]}...')
        else:
            print(f'{cell_ref}: NOT FOUND')
    
    print()
    print('=== FULL SHEET2 XML (first 2000 chars) ===')
    print(xml_str[:2000])
