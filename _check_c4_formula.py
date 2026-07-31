import zipfile
import re

# Check the actual formula in C4 of the template
template_file = 'd:/next-postgres-starter/public/Handover Tamplate New.xlsx'

with zipfile.ZipFile(template_file, 'r') as z:
    s1 = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Find C4 cell specifically
    c4_match = re.search(r'<c r="C4"[^>]*>(.*?)</c>', s1, re.DOTALL)
    if c4_match:
        c4_content = c4_match.group(1)
        print("C4 cell content from template:")
        print(c4_content[:500])
        
        # Extract the formula
        formula_match = re.search(r'<f>(.*?)</f>', c4_content, re.DOTALL)
        if formula_match:
            formula = formula_match.group(1)
            # Unescape XML entities
            formula = formula.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'")
            print("\n\nUnescaped formula:")
            print(formula[:300])
