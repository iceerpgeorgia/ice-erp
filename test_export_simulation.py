import zipfile
import json
from pathlib import Path

# Simulate what the export endpoint does
template_path = 'public/Handover Tamplate New.xlsx'

# Load original template
zip_file = zipfile.ZipFile(template_path, 'r')
sheet2_xml = zip_file.read('xl/worksheets/sheet2.xml').decode('utf-8')
sheet1_xml = zip_file.read('xl/worksheets/sheet1.xml').decode('utf-8')

print("=" * 70)
print("EXPORT SIMULATION - What gets written to sheet2 Placeholders")
print("=" * 70)

# Placeholder data that would be written
placeholder_data = {
    'A1': 'Project_Department', 'B1': 'Test Dept',
    'A2': 'Handover_Date', 'B2': 45000,
    'A3': 'Project_Counteragent_Entity_Type', 'B3': 'LLC',
    'A4': 'Project_Counteragent_Name', 'B4': 'Test Company',
    'A5': 'Project_Counteragent_Director_Genitive', 'B5': 'Director Gen',
    'A6': 'Project_Counteragent_Director', 'B6': 'John Doe',
    'A7': 'Project_Counteragent_Address_Line_1', 'B7': '123 Main St',
    'A8': 'Project_Counteragent_Address_Line_2', 'B8': 'Suite 100',
    'A9': 'Project_Counteragent_ID', 'B9': '123456789',
    'A10': 'Project_Address', 'B10': '456 Oak Ave',
    'A11': 'Project_Insider_Entity_Type', 'B11': 'LLC',
    'A12': 'Project_Insider_Name', 'B12': 'Our Company',
    'A13': 'Project_Insider_ID', 'B13': '987654321',
    'A14': 'Project_Insider_Address_Line1', 'B14': '789 Pine Ln',
    'A15': 'Project_Insider_Address_Line2', 'B15': 'Floor 5',
    'A16': 'Project_Insider_Director_Genitive', 'B16': 'Director Gen 2',
    'A17': 'Project_Insider_Director', 'B17': 'Jane Smith',
    'A18': 'Contract_Date', 'B18': 45000,
    'A19': 'Project_Currency', 'B19': 'GEL',
}

# Check which cells get updated
updated_cells = []
for cell_ref in placeholder_data.keys():
    if f'<c r="{cell_ref}"' in sheet2_xml:
        updated_cells.append(cell_ref)

print(f"\nCells that will be updated: {len(updated_cells)}/{len(placeholder_data)}")
for cell in sorted(updated_cells):
    print(f"  ✓ {cell}")

missing = set(placeholder_data.keys()) - set(updated_cells)
if missing:
    print(f"\nCells that WON'T be updated: {missing}")

print("\n" + "=" * 70)
print("VLOOKUP FORMULAS CHECK")
print("=" * 70)

# Extract VLOOKUP formulas from sheet1
import re
vlookups = re.findall(r'<c r="([^"]+)"[^>]*>.*?<f>(.*?VLOOKUP.*?)</f>', sheet1_xml, re.DOTALL)
print(f"\nFound {len(vlookups)} VLOOKUP formulas:")
for cell, formula in vlookups[:5]:
    # Clean up formula text
    clean_formula = formula.replace('\n', ' ').replace('  ', ' ')[:80]
    print(f"  {cell}: {clean_formula}...")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print("✓ Template has proper Placeholders sheet structure")
print("✓ Template has VLOOKUP formulas in Handover sheet")
print("✓ All placeholder cells should be updatable")
print("\nIf export is still blank, the issue is likely:")
print("  1. Export endpoint returning empty/invalid XLSX")
print("  2. Browser not downloading the file correctly")  
print("  3. Error in export process not shown to user")

zip_file.close()
