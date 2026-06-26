import zipfile
import xml.etree.ElementTree as ET

test_file = 'd:/final-test.xlsx'

try:
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
        
        print("=" * 70)
        print("SHEET1 (HANDOVER) - First 2000 chars")
        print("=" * 70)
        print(sheet1_xml[:2000])
        
        print("\n" + "=" * 70)
        print("SHEET2 (PLACEHOLDERS) - First 3000 chars")
        print("=" * 70)
        print(sheet2_xml[:3000])
        
        # Look for visible cell content in sheet1
        print("\n" + "=" * 70)
        print("CELLS WITH VALUES IN SHEET1")
        print("=" * 70)
        
        # Find cells with inline string content
        import re
        cells_with_text = re.findall(r'<c r="([A-Z]+\d+)"[^>]*><is><t>(.*?)</t></is></c>', sheet1_xml)
        print(f"\nFound {len(cells_with_text)} cells with text content:")
        for cell, text in cells_with_text[:10]:
            print(f"  {cell}: {text[:50]}")
        
        # Find cells with values
        cells_with_values = re.findall(r'<c r="([A-Z]+\d+)"[^>]*><v>(.*?)</v></c>', sheet1_xml)
        print(f"\nFound {len(cells_with_values)} cells with numeric values:")
        for cell, value in cells_with_values[:10]:
            print(f"  {cell}: {value[:50]}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
