import zipfile
import xml.etree.ElementTree as ET
import re

template_file = 'd:/next-postgres-starter/public/Handover Tamplate New CLEANED.xlsx'

try:
    with zipfile.ZipFile(template_file, 'r') as z:
        sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        
        print("=" * 70)
        print("EXAMINING FORMULAS IN HANDOVER SHEET (sheet1.xml)")
        print("=" * 70)
        
        # Find all formula elements
        formulas = re.findall(r'<f>(.*?)</f>', sheet1_xml)
        
        print(f"\nTotal formulas found: {len(formulas)}\n")
        
        # Get unique formulas
        unique_formulas = set(formulas)
        print(f"Unique formula patterns: {len(unique_formulas)}\n")
        
        # Print first 10 unique formulas
        for i, formula in enumerate(list(unique_formulas)[:10]):
            print(f"{i+1}. {formula[:100]}")
        
        # Check for Placeholders sheet references
        placeholders_refs = [f for f in formulas if 'Placeholders' in f]
        print(f"\n\nFormulas referencing Placeholders sheet: {len(placeholders_refs)}")
        
        if placeholders_refs:
            print("\nExamples of Placeholders references:")
            for ref in placeholders_refs[:5]:
                print(f"  {ref}")
        
        # Check the structure of cells with formulas
        print("\n\n" + "=" * 70)
        print("CHECKING CELL-FORMULA ASSOCIATIONS")
        print("=" * 70)
        
        # Find cells with formulas
        cell_formula_pattern = r'<c r="([A-Z]+\d+)"[^>]*>.*?<f>(.*?)</f>'
        cell_formulas = re.findall(cell_formula_pattern, sheet1_xml)
        
        print(f"\nCells with formulas: {len(cell_formulas)}\n")
        
        # Print first 10
        for i, (cell_ref, formula) in enumerate(cell_formulas[:10]):
            print(f"{cell_ref}: {formula[:80]}")
        
        # Check for VLOOKUP patterns
        vlookup_count = len([f for f in formulas if 'VLOOKUP' in f or 'vlookup' in f])
        print(f"\n\nVLOOKUP formulas found: {vlookup_count}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
