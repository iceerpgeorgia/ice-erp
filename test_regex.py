#!/usr/bin/env python3
"""Test the regex pattern on actual cell XML"""

import re

# Sample cell with formula and cached value
cell_c4 = '<c r="C4" s="19" t="b"><f>IF(VLOOKUP("Project_Department",Placeholders!A:B,2,FALSE)&lt;&gt;"",IF(\n    VLOOKUP("Project_Department",Placeholders!A:B,2,FALSE)="Tbilisi",\n    "ქ. თბილისი",\n    "ქ. ბათუმი"\n))</f><v>0</v></c>'

cell_j16 = '<c r="J16" s="6" t="str"><f>"თანხა "&amp;IF(Project_Currency="USD"," $", IF(Project_Currency = "EUR", " €"," ₾"))</f><v>თანხა  ₾</v></c>'

print("Testing regex pattern on actual cell XML:\n")
print("=" * 70)

# Test the pattern
pattern = r'(<c[^>]*>.*?<f>.*?</f>)(\s*<v>.*?</v>)'

for name, cell in [("C4", cell_c4), ("J16", cell_j16)]:
    print(f"\n{name}:")
    print(f"BEFORE: {cell[:80]}...")
    
    # Try the replacement
    result = re.sub(pattern, r'\1', cell, flags=re.DOTALL)
    print(f"AFTER:  {result[:80]}...")
    
    # Check if it worked
    if '<v>' in result:
        print("❌ FAILED - <v> still present")
    else:
        print("✅ SUCCESS - <v> removed")

print("\n" + "=" * 70)
print("\nNow test on entire XML with multiple cells...\n")

# Test on a chunk with multiple cells
xml_chunk = '''<row r="4" spans="3:23" x14ac:dyDescent="0.25"><c r="C4" s="19" t="b"><f>IF(VLOOKUP("Project_Department",Placeholders!A:B,2,FALSE)&lt;&gt;"",IF(
    VLOOKUP("Project_Department",Placeholders!A:B,2,FALSE)="Tbilisi",
    "ქ. თბილისი",
    "ქ. ბათუმი"
))</f><v>0</v></c><c r="D4" s="19" t="str"><f>DAY(VLOOKUP("Handover_Date",Placeholders!A:B,2,FALSE))&amp;
" "&amp;test</f><v>0 იანვარი 1900</v></c><c r="E4" s="19"/></row>'''

print("BEFORE:")
v_count_before = len(re.findall(r'<v>', xml_chunk))
f_count = len(re.findall(r'<f>', xml_chunk))
print(f"  Formulas: {f_count}")
print(f"  <v> tags: {v_count_before}")

result = re.sub(pattern, r'\1', xml_chunk, flags=re.DOTALL)

print("\nAFTER:")
v_count_after = len(re.findall(r'<v>', result))
print(f"  Formulas: {len(re.findall(r'<f>', result))}")
print(f"  <v> tags: {v_count_after}")
print(f"  Removed: {v_count_before - v_count_after}")

if v_count_after == 0:
    print("\n✅ SUCCESS - All <v> tags removed from formula cells!")
else:
    print(f"\n❌ FAILED - {v_count_after} <v> tags still remain")
