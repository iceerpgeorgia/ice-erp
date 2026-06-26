import requests
import json
import zipfile
import re
from io import BytesIO

# Test the production export endpoint
url = "https://ice-erp.vercel.app/api/export/handover-template"

# Use a project UUID (from earlier tests)
project_uuid = "808bf640-8295-46a9-a083-c43472345717"

payload = {
    "projectUuid": project_uuid,
    "fileName": "test-export.xlsx"
}

print("Testing production export endpoint...")
print(f"URL: {url}")
print(f"Project: {project_uuid}")
print()

try:
    response = requests.post(url, json=payload, timeout=30)
    
    print(f"Response Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    print(f"Content-Length: {response.headers.get('Content-Length')}")
    print()
    
    if response.status_code == 200:
        # Check if it's a valid Excel file
        try:
            with zipfile.ZipFile(BytesIO(response.content)) as z:
                print("✓ File is valid XLSX")
                sheets = z.namelist()
                print(f"Files in archive: {len(sheets)}")
                
                # Check sheet2.xml for Placeholders data
                if 'xl/worksheets/sheet2.xml' in sheets:
                    s2_xml = z.read('xl/worksheets/sheet2.xml').decode('utf-8')
                    # Count cells with content
                    has_a_column = 'Project_Department' in s2_xml
                    has_b_column = 'Tbilisi' in s2_xml or '45' in s2_xml
                    
                    print(f"✓ Sheet2 exists")
                    print(f"  - Column A has labels: {has_a_column}")
                    print(f"  - Column B has values: {has_b_column}")
                    
                    # Count VLOOKUP in sheet1
                    if 'xl/worksheets/sheet1.xml' in sheets:
                        s1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
                        vlookup_count = s1_xml.count('VLOOKUP')
                        print(f"\n✓ Sheet1 exists")
                        print(f"  - VLOOKUP formulas: {vlookup_count}")
                        
                        if vlookup_count == 0:
                            print("\n⚠️  WARNING: No VLOOKUP formulas found!")
                        
        except Exception as e:
            print(f"✗ File parsing error: {e}")
    else:
        print(f"✗ Error: {response.text[:200]}")

except requests.exceptions.Timeout:
    print("✗ Request timeout")
except Exception as e:
    print(f"✗ Error: {e}")
