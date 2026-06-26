import zipfile
import re

test_file = 'd:/final-test.xlsx'

with zipfile.ZipFile(test_file, 'r') as z:
    s1 = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Find all <f>...</f> elements (formulas)
    all_formulas = re.findall(r'<f>(.*?)</f>', s1, re.DOTALL)
    print(f"Formulas in exported file: {len(all_formulas)}\n")
    for i, formula in enumerate(all_formulas[:3]):
        # Remove newlines for display
        f_clean = formula.replace('\n', ' ').replace('  ', ' ')[:100]
        print(f"{i+1}. {f_clean}")
    
    # Check cells that have formulas
    cells_with_formulas = re.findall(r'<c r="([A-Z]+\d+)"[^>]*>.*?<f>', s1, re.DOTALL)
    print(f"\n\nCells with formulas (first 10): {cells_with_formulas[:10]}")
    
    # Look for any content at all in first 20 rows
    print(f"\n\nLooking for content in first 20 rows...")
    for row_num in range(1, 21):
        # Find row element
        row_pattern = f'<row r="{row_num}"[^>]*>(.*?)</row>'
        row_match = re.search(row_pattern, s1, re.DOTALL)
        if row_match:
            row_content = row_match.group(1)
            # Count cells in this row
            cell_count = len(re.findall(r'<c ', row_content))
            if cell_count > 0:
                print(f"Row {row_num}: {cell_count} cells")
                # Show first cell content
                first_cell = re.search(r'<c r="([A-Z]+\d+)"[^>]*>(.*?)</c>', row_content, re.DOTALL)
                if first_cell:
                    cell_ref, cell_content = first_cell.groups()
                    content_preview = cell_content[:100].replace('\n', ' ')
                    print(f"  First cell ({cell_ref}): {content_preview[:50]}")
