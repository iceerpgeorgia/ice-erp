import zipfile
import re
import xml.etree.ElementTree as ET

# Test the actual exported file
test_file = 'd:/final-test.xlsx'

try:
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    
    print("=" * 70)
    print("EXPORTED FILE ANALYSIS")
    print("=" * 70)
    
    # Check sheet1.xml (Handover)
    print("\n[SHEET1 - HANDOVER]")
    v_tags = len(re.findall(r'<v>', sheet1_xml))
    formula_tags = len(re.findall(r'<f[^>]*>', sheet1_xml))
    cell_tags = len(re.findall(r'<c r=', sheet1_xml))
    
    print(f"  Cell elements: {cell_tags}")
    print(f"  Formula elements: {formula_tags}")
    print(f"  Value tags <v>: {v_tags}")
    
    # Check if formulas have values
    formula_with_value = len(re.findall(r'<f[^>]*>.*?</f>.*?<v>', sheet1_xml, re.DOTALL))
    formula_without_value = formula_tags - formula_with_value
    
    print(f"  Formulas with cached values: {formula_with_value}")
    print(f"  Formulas without values: {formula_without_value}")
    
    # Check sheet2.xml (Placeholders)
    print("\n[SHEET2 - PLACEHOLDERS]")
    placeholder_cells = len(re.findall(r'<c r="[AB]\d+"', sheet2_xml))
    print(f"  Placeholder cells: {placeholder_cells}")
    
    # Sample first formula
    first_formula = re.search(r'<f[^>]*>([^<]+)</f>', sheet1_xml)
    if first_formula:
        print(f"\n[SAMPLE FORMULA]")
        print(f"  {first_formula.group(1)[:80]}...")
    
    print("\n" + "=" * 70)
    if formula_without_value >= formula_tags - 2:  # Most formulas have no cached values
        print("✓ FORMULAS SHOULD RECALCULATE (most have no cached values)")
    else:
        print(f"✗ ISSUE: {formula_with_value} formulas still have cached values")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
