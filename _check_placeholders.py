import zipfile
import re
import xml.etree.ElementTree as ET

test_file = 'd:/final-test.xlsx'

try:
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    # Parse to find cell values
    root = ET.fromstring(sheet2_xml)
    ns = {'ss': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET CONTENT (Sheet2)")
    print("=" * 70)
    
    # Extract all cells
    cells = {}
    for c_elem in root.findall('.//ss:c', ns):
        cell_ref = c_elem.get('r')
        
        # Try to get text value (inlineStr)
        is_elem = c_elem.find('.//ss:is/ss:t', ns)
        if is_elem is not None and is_elem.text:
            cells[cell_ref] = is_elem.text
        else:
            # Try numeric value
            v_elem = c_elem.find('.//ss:v', ns)
            if v_elem is not None and v_elem.text:
                cells[cell_ref] = v_elem.text
    
    # Show all B column values (should be data)
    print("\nColumn B values (data):")
    for row in range(1, 20):
        cell_ref = f'B{row}'
        value = cells.get(cell_ref, '[EMPTY]')
        print(f"  {cell_ref}: {value}")
    
    print(f"\nTotal cells with data: {len(cells)}")
    
    # Check for VLOOKUP reference in sheet1
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    vlookup_range = re.search(r'VLOOKUP.*?Placeholders!([\w:!$]+)', sheet1_xml)
    if vlookup_range:
        print(f"\nVLOOKUP range in formulas: Placeholders!{vlookup_range.group(1)}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
