import zipfile
import xml.etree.ElementTree as ET

test_file = 'd:/final-test.xlsx'

try:
    with zipfile.ZipFile(test_file, 'r') as z:
        # Get all sheets
        workbook_xml = z.read('xl/workbook.xml').decode('utf-8')
        root = ET.fromstring(workbook_xml)
        ns = {'wb': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
              'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
        
        print("=" * 70)
        print("WORKBOOK STRUCTURE")
        print("=" * 70)
        
        sheets = root.findall('.//wb:sheet', ns)
        print(f"\nSheets in workbook ({len(sheets)} total):")
        for sheet in sheets:
            name = sheet.get('name')
            sheet_id = sheet.get('sheetId')
            rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            print(f"  {sheet_id}: {name:30s} (r:id={rid})")
        
        # Check workbook rels
        workbook_rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
        rels_root = ET.fromstring(workbook_rels)
        ns_rels = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
        
        print(f"\nWorksheet relationships:")
        for rel in rels_root.findall('.//r:Relationship', ns_rels):
            rid = rel.get('Id')
            target = rel.get('Target')
            if 'worksheet' in target:
                print(f"  {rid:10s} -> {target}")
        
        # Find sheet2.xml mapping
        print(f"\nSheet name to file mapping:")
        print(f"  Sheet1 (Handover) -> xl/worksheets/sheet1.xml")
        print(f"  Sheet2 (Placeholders) -> xl/worksheets/sheet2.xml")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
