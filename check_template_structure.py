import zipfile

template_path = 'public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_path, 'r') as z:
    sheet2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
    sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    print("=" * 70)
    print("PLACEHOLDERS SHEET (sheet2.xml)")
    print("=" * 70)
    
    # Count cells and values
    cell_count = sheet2_xml.count('<c r=')
    value_count = sheet2_xml.count('<v>')
    print(f"Total cells: {cell_count}")
    print(f"Total values: {value_count}")
    
    # Check for specific cells A1-A19, B1-B19
    print("\nCell structure check:")
    missing_a = []
    missing_b = []
    for i in range(1, 20):
        has_a = f'<c r="A{i}"' in sheet2_xml
        has_b = f'<c r="B{i}"' in sheet2_xml
        if not has_a:
            missing_a.append(i)
        if not has_b:
            missing_b.append(i)
    
    if missing_a:
        print(f"  ✗ Missing A cells: {missing_a}")
    else:
        print(f"  ✓ All A1-A19 cells exist")
    
    if missing_b:
        print(f"  ✗ Missing B cells: {missing_b}")
    else:
        print(f"  ✓ All B1-B19 cells exist")
    
    # Print first 500 chars of sheet2
    print("\nSheet2 XML snippet (first 1000 chars):")
    print(sheet2_xml[:1000])
    
    print("\n" + "=" * 70)
    print("HANDOVER SHEET (sheet1.xml)")
    print("=" * 70)
    
    # Count formulas
    formula_count = sheet1_xml.count('<f>')
    print(f"Formulas in sheet1: {formula_count}")
    
    # Find VLOOKUP formulas
    import re
    vlookups = re.findall(r'<f>.*?VLOOKUP.*?</f>', sheet1_xml, re.DOTALL)
    print(f"VLOOKUP formulas: {len(vlookups)}")
    
    if vlookups and len(vlookups) <= 3:
        print("\nVLOOKUP examples:")
        for i, vl in enumerate(vlookups[:3], 1):
            # Extract just the formula text
            formula = re.search(r'<f>(.*?)</f>', vl, re.DOTALL)
            if formula:
                formula_text = formula.group(1)[:100]
                print(f"  {i}. {formula_text}...")
    
    # Count merged cells
    merge_count = sheet1_xml.count('<mergeCells')
    print(f"Merged cells sections: {merge_count}")
    
    print("\nSheet1 XML snippet (first 1000 chars):")
    print(sheet1_xml[:1000])
