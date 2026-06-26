import zipfile
import re

test_file = 'd:/final-test.xlsx'

with zipfile.ZipFile(test_file, 'r') as z:
    s2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET - DETAILED ANALYSIS")
    print("=" * 70)
    
    # Extract all rows
    rows = re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', s2_xml, re.DOTALL)
    print(f"\nTotal rows: {len(rows)}")
    
    print("\n\nDETAILED ROW CONTENT (first 5 rows):\n")
    for row_num, row_content in rows[:5]:
        print(f"Row {row_num}:")
        print(f"  Raw XML (first 400 chars): {row_content[:400]}")
        
        # Extract all cells
        cells = re.findall(r'<c r="([A-Z]\d+)"[^>]*>(.*?)</c>', row_content, re.DOTALL)
        print(f"  Cells found: {len(cells)}")
        
        for col_cell, cell_content in cells:
            # Extract text
            text_match = re.search(r'<is><t>(.*?)</t></is>', cell_content)
            if text_match:
                text = text_match.group(1)
                print(f"    {col_cell}: TEXT = {text[:40]}")
            else:
                # Check for value
                val_match = re.search(r'<v>(.*?)</v>', cell_content)
                if val_match:
                    print(f"    {col_cell}: VALUE = {val_match.group(1)}")
                else:
                    print(f"    {col_cell}: EMPTY or FORMULA")
        print()
    
    # Summary check
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    # Count how many cells have A column content
    a_cells_with_content = 0
    b_cells_with_content = 0
    
    for row_num, row_content in rows:
        if 'r="A' in row_content and '<is><t>' in row_content:
            a_cells_with_content += 1
        if 'r="B' in row_content and ('<is><t>' in row_content or '<v>' in row_content):
            b_cells_with_content += 1
    
    print(f"Rows with A column content (text): {a_cells_with_content}")
    print(f"Rows with B column content (text or value): {b_cells_with_content}")
