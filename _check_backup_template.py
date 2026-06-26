import zipfile

# Check if there's a backup of the original template that might have the correct structure
files = ['d:/next-postgres-starter/public/Handover Tamplate New_backup.xlsx']

for template_file in files:
    try:
        with zipfile.ZipFile(template_file, 'r') as z:
            sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            
            # Count different cell types
            import re
            cells_with_formulas = len(re.findall(r'<f>.*?</f>', sheet1_xml))
            cells_with_values = len(re.findall(r'<v>.*?</v>', sheet1_xml))
            cells_with_text = len(re.findall(r'<is><t>.*?</t></is>', sheet1_xml))
            
            print(f"\nTemplate: {template_file}")
            print(f"  Cells with formulas: {cells_with_formulas}")
            print(f"  Cells with values: {cells_with_values}")
            print(f"  Cells with inline text: {cells_with_text}")
            
            # Get first 1000 chars of sheetData to see what's in there
            sheet_data_match = re.search(r'<sheetData>(.*?)</sheetData>', sheet1_xml, re.DOTALL)
            if sheet_data_match:
                data = sheet_data_match.group(1)
                print(f"  SheetData length: {len(data)} chars")
                print(f"  First 1500 chars:\n{data[:1500]}\n")
    
    except FileNotFoundError:
        print(f"File not found: {template_file}")
    except Exception as e:
        print(f"Error reading {template_file}: {e}")
