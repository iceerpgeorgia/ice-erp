#!/usr/bin/env python3
import zipfile
import re

test_file = "d:/test-cleaned.xlsx"
try:
    with zipfile.ZipFile(test_file, 'r') as z:
        sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Count <v> tags and #N/A errors
    v_count = len(re.findall(r'<v>', sheet1_xml))
    na_count = len(re.findall(r'<v>#N/A</v>', sheet1_xml))
    
    print("=" * 60)
    print("CLEANED TEMPLATE TEST RESULT")
    print("=" * 60)
    print(f"Total <v> tags: {v_count}")
    print(f"#N/A errors: {na_count}")
    
    if v_count == 0:
        print("\n✓ SUCCESS! Cached values have been completely CLEARED!")
        print("✓ Formulas will recalculate fresh when file is opened in Excel")
    else:
        print(f"\n✗ FAILED - Still {v_count} cached value tags present")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
