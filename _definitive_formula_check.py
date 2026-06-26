import zipfile
import re
import xml.etree.ElementTree as ET

template_file = 'd:/next-postgres-starter/public/Handover Tamplate New CLEANED.xlsx'

with zipfile.ZipFile(template_file, 'r') as z:
    s1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Method 1: Regex to find all <f> tags
    formula_tags = re.findall(r'<f>(.*?)</f>', s1_xml, re.DOTALL)
    print(f"Total <f> tags found: {len(formula_tags)}")
    
    # Method 2: Count VLOOKUP occurrences  
    vlookup_count = s1_xml.count('VLOOKUP')
    print(f"VLOOKUP occurrences: {vlookup_count}")
    
    # Method 3: Parse XML properly
    try:
        root = ET.fromstring(s1_xml)
        ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        
        # Find all formula elements
        formulas = root.findall('.//f', {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'})
        print(f"XML parsing found {len(formulas)} formulas")
        
        # Find cells with formulas
        cells_with_f = root.findall('.//c[@f]' if 'c[@f]' in str(root) else './/c', {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'})
        print(f"Cells with formula attribute: {len([c for c in cells_with_f if 'f' in c.attrib if hasattr(c, 'attrib')])}")
    except:
        pass
    
    # Show first few formulas
    print(f"\nFirst 3 formulas (unescaped):")
    for i, f in enumerate(formula_tags[:3]):
        f_unescaped = f.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
        print(f"{i+1}. {f_unescaped[:80]}")
