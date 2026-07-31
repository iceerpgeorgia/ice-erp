import zipfile
import xml.etree.ElementTree as ET

test_file = 'd:/final-test.xlsx'

try:
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    root = ET.fromstring(sheet2_xml)
    ns = {'ss': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET - BOTH COLUMNS")
    print("=" * 70)
    
    cells = {}
    for c_elem in root.findall('.//ss:c', ns):
        cell_ref = c_elem.get('r')
        is_elem = c_elem.find('.//ss:is/ss:t', ns)
        if is_elem is not None and is_elem.text:
            cells[cell_ref] = is_elem.text
        else:
            v_elem = c_elem.find('.//ss:v', ns)
            if v_elem is not None and v_elem.text:
                cells[cell_ref] = v_elem.text
    
    print("\nAll cells (A and B columns):")
    for row in range(1, 20):
        a_val = cells.get(f'A{row}', '[EMPTY]')
        b_val = cells.get(f'B{row}', '[EMPTY]')
        print(f"  Row {row:2d} | A: {str(a_val)[:40]:40s} | B: {str(b_val)[:40]}")
    
    # Verify VLOOKUP will work
    has_labels = any(c for c in cells if c.startswith('A'))
    has_values = any(c for c in cells if c.startswith('B'))
    
    print(f"\n✓ Column A labels present: {has_labels}")
    print(f"✓ Column B values present: {has_values}")
    print(f"✓ VLOOKUP should work: {has_labels and has_values}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
