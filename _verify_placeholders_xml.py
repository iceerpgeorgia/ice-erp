import zipfile
import re

test_file = 'd:/final-test.xlsx'

with zipfile.ZipFile(test_file, 'r') as z:
    s2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET XML - ROW 1 EXTRACTION")
    print("=" * 70)
    
    # Find row 1
    row1_match = re.search(r'<row r="1"[^>]*>(.*?)</row>', s2_xml, re.DOTALL)
    if row1_match:
        row1_xml = row1_match.group(1)
        print("\nRow 1 XML (first 800 chars):")
        print(row1_xml[:800])
        
        # Extract cells from row 1
        cells = re.findall(r'<c r="([A-Z]\d+)"[^>]*>(.*?)</c>', row1_xml, re.DOTALL)
        print(f"\n\nCells in row 1: {len(cells)}")
        for cell_ref, cell_content in cells:
            # Extract inline string if present
            text_match = re.search(r'<is><t>(.*?)</t></is>', cell_content, re.DOTALL)
            if text_match:
                text = text_match.group(1)
                print(f"  {cell_ref}: {text[:50]}")
            else:
                # Check for numeric value
                val_match = re.search(r'<v>(.*?)</v>', cell_content)
                if val_match:
                    print(f"  {cell_ref}: VALUE={val_match.group(1)}")
                else:
                    print(f"  {cell_ref}: {cell_content[:50]}")
