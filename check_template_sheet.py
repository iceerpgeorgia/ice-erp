import zipfile

# Extract sheet1.xml from template
template_path = 'public/Handover Tamplate New.xlsx'
with zipfile.ZipFile(template_path, 'r') as z:
    xml_str = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Check size and basic structure
    print(f'Template sheet1.xml size: {len(xml_str)} bytes')
    print(f'Contains cells: {xml_str.count("<c ")} cell tags')
    print(f'Contains formulas: {xml_str.count("<f>")} formula tags')
    print(f'Contains values: {xml_str.count("<v>")} value tags')
    print(f'Contains rows: {xml_str.count("<row")} row tags')
    print()
    
    # Show first 1500 chars
    print('First 1500 chars:')
    print(xml_str[:1500])
