import zipfile
import re

test_file = 'd:/final-test.xlsx'

with zipfile.ZipFile(test_file, 'r') as z:
    s2 = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET (Sheet2) STRUCTURE")
    print("=" * 70)
    print("\nFirst 3000 chars of sheet2.xml:")
    print(s2[:3000])
    
    # Extract all rows
    rows = re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', s2, re.DOTALL)
    print(f"\n\nTotal rows: {len(rows)}")
    
    print("\nFirst 10 rows content:")
    for row_num, row_content in rows[:10]:
        # Get cells
        cells = re.findall(r'<c r="([A-Z]+)(\d+)"[^>]*><is><t>(.*?)</t></is></c>', row_content)
        print(f"\nRow {row_num}:")
        for col, _, value in cells:
            print(f"  {col}{row_num}: {value[:50]}")
