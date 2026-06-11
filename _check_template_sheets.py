#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET

# Open the Excel file (which is a ZIP)
xlsx_path = 'public/handover template.xlsx'
with zipfile.ZipFile(xlsx_path, 'r') as zip_ref:
    # List all files in the ZIP
    print("Files in template:")
    for name in sorted(zip_ref.namelist()):
        if 'worksheet' in name or 'workbook' in name:
            print(f"  {name}")
    
    # Read the workbook.xml to see sheet names
    print("\nSheet names from workbook.xml:")
    try:
        wb_content = zip_ref.read('xl/workbook.xml').decode('utf-8')
        root = ET.fromstring(wb_content)
        # Try to find sheets with and without namespace
        sheets = root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
        if not sheets:
            sheets = root.findall('.//sheet')
        
        for sheet in sheets:
            sheet_name = sheet.get('name', 'UNNAMED')
            sheet_id = sheet.get('sheetId', '?')
            print(f"  - {sheet_name} (id={sheet_id})")
    except Exception as e:
        print(f"  Error reading workbook: {e}")
        import traceback
        traceback.print_exc()
