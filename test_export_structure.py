import zipfile
import json

# Call the export API
import urllib.request

url = 'https://ice-erp.vercel.app/api/export/handover-template'
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

payload = json.dumps({'projectUuid': project_uuid}).encode('utf-8')
headers = {'Content-Type': 'application/json'}

try:
    req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=30) as response:
        export_data = response.read()
        print(f'Export downloaded: {len(export_data)} bytes')
        
        # Save to file
        with open('exported_handover_test.xlsx', 'wb') as f:
            f.write(export_data)
        
        # Check sheet1.xml structure
        with zipfile.ZipFile('exported_handover_test.xlsx', 'r') as z:
            xml_str = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            print(f'\nExported sheet1.xml size: {len(xml_str)} bytes')
            print(f'Contains cells: {xml_str.count("<c ")} cell tags')
            print(f'Contains formulas: {xml_str.count("<f>")} formula tags')
            print(f'Contains values: {xml_str.count("<v>")} value tags')
            print(f'Contains rows: {xml_str.count("<row")} row tags')
            
            # Show if sheet is empty
            if '<sheetData' in xml_str:
                start = xml_str.find('<sheetData')
                end = xml_str.find('</sheetData>', start) + len('</sheetData>')
                sheet_data = xml_str[start:end]
                print(f'\nsheetData size: {len(sheet_data)} bytes')
                if len(sheet_data) < 200:
                    print('sheetData content (POSSIBLY EMPTY):')
                    print(sheet_data)
            else:
                print('ERROR: No sheetData found!')
            
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
