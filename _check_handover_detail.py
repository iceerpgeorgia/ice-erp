import zipfile
import re

test_file = 'd:/final-test.xlsx'

with zipfile.ZipFile(test_file, 'r') as z:
    s1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    print("=" * 70)
    print("HANDOVER SHEET - FORMULA LOCATIONS")
    print("=" * 70)
    
    # Find all cells with VLOOKUP formulas
    cells_with_vlookup = re.findall(r'<c r="([A-Z]+\d+)"[^>]*>.*?<f>.*?VLOOKUP.*?</f>', s1_xml, re.DOTALL)
    
    print(f"\nCells with VLOOKUP formulas: {len(cells_with_vlookup)}")
    print("Cell references:", sorted(set(cells_with_vlookup)))
    
    # Get more detail - show formulas and cell types
    print("\n\nDetailed formula list:")
    cells_with_formulas = re.findall(r'<c r="([A-Z]+\d+)"[^>]*>(.*?<f>.*?</f>.*?)</c>', s1_xml, re.DOTALL)
    
    for i, (cell_ref, cell_content) in enumerate(cells_with_formulas[:10]):
        formula_match = re.search(r'<f>(.*?)</f>', cell_content, re.DOTALL)
        if formula_match:
            formula = formula_match.group(1)[:80]
            # Unescape basic entities
            formula = formula.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
            print(f"{i+1}. {cell_ref}: {formula}")
    
    # Check if these cells are in the visible range
    # Get dimension
    dim_match = re.search(r'<dimension ref="([A-Z:0-9]+)"', s1_xml)
    if dim_match:
        print(f"\n\nSheet dimension: {dim_match.group(1)}")
    
    # Extract some cell dimensions to understand the layout
    print("\n\nMerged cells (if any):")
    merged_match = re.search(r'<mergeCells>(.*?)</mergeCells>', s1_xml, re.DOTALL)
    if merged_match:
        merged = merged_match.group(1)
        merge_cells = re.findall(r'<mergeCell ref="([A-Z:0-9]+)"', merged)
        for mc in merge_cells[:5]:
            print(f"  {mc}")
    else:
        print("  (no merged cells)")
    
    # Check column widths to see if columns might be hidden
    print("\n\nColumn definitions (first 5):")
    col_defs = re.findall(r'<col min="(\d+)" max="(\d+)"[^>]* width="([^"]+)"[^>]*(.*?)/>', s1_xml)
    for i, (min_col, max_col, width, attrs) in enumerate(col_defs[:5]):
        hidden = 'hidden="1"' in attrs
        print(f"  Col {min_col}-{max_col}: width={width}, hidden={hidden}")
