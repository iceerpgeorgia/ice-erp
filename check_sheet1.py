import zipfile
import re

z = zipfile.ZipFile('public/Handover Tamplate New.xlsx')
sheet1 = z.read('xl/worksheets/sheet1.xml').decode('utf-8')

# Find formula cells
formula_pattern = r'<c r="([A-Z]+\d+)"[^>]*>.*?<f>(.*?)</f>(?:.*?<v>(.*?)</v>)?.*?</c>'
formulas = re.findall(formula_pattern, sheet1, re.DOTALL)

print('=== Formula cells in Handover sheet ===')
print(f'Total formulas found: {len(formulas)}\n')

for i, (cell, formula, cached) in enumerate(formulas[:10]):
    print(f'{i+1}. Cell {cell}:')
    print(f'   Formula: {formula.strip()[:100]}')
    print(f'   Cached value: "{cached.strip()[:50]}"' if cached else '   Cached value: (empty/none)')
    print()
