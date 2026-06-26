import requests
from io import BytesIO
import zipfile
import re

# Get the production export
url = "https://ice-erp.vercel.app/api/export/handover-template"
payload = {"projectUuid": "808bf640-8295-46a9-a083-c43472345717", "fileName": "test.xlsx"}

response = requests.post(url, json=payload, timeout=30)

if response.status_code == 200:
    with zipfile.ZipFile(BytesIO(response.content)) as z:
        # Check workbook.xml to see sheet names
        workbook_xml = z.read('xl/workbook.xml').decode('utf-8')
        
        print("=" * 70)
        print("SHEET NAMES IN WORKBOOK")
        print("=" * 70)
        
        sheet_names = re.findall(r'<sheet name="([^"]+)"', workbook_xml)
        print(f"\nSheet names: {sheet_names}")
        
        # Now check formulas to see what they reference
        s1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
        
        # Find all sheet references in formulas
        formula_refs = re.findall(r'([A-Za-z_0-9]+)![A-Z0-9:$!]+', s1_xml)
        unique_refs = set(formula_refs)
        
        print(f"\n\nSheet references in formulas: {unique_refs}")
        
        # Check if "Placeholders" exists
        if 'Placeholders' in sheet_names:
            print("✓ Placeholders sheet exists in workbook")
        else:
            print("✗ WARNING: Placeholders sheet NOT in workbook!")
            
        # Get all formula examples that reference sheets
        formulas_with_refs = re.findall(r'<f>([^<]*[A-Za-z_][A-Za-z0-9_]*![A-Z][^<]*)</f>', s1_xml, re.DOTALL)
        
        print(f"\n\nFormulas with sheet references (first 3):")
        for i, formula in enumerate(formulas_with_refs[:3]):
            f_clean = formula.replace('\n', ' ').replace('&lt;', '<').replace('&amp;', '&')
            print(f"{i+1}. {f_clean[:100]}")
        
else:
    print(f"Error: {response.status_code}")
