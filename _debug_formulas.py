import zipfile
import re

template_file = 'd:/next-postgres-starter/public/Handover Tamplate New CLEANED.xlsx'

with zipfile.ZipFile(template_file, 'r') as z:
    s1 = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    
    # Find all <f>...</f> elements (formulas)
    all_formulas = re.findall(r'<f>(.*?)</f>', s1, re.DOTALL)
    print(f"All formulas found: {len(all_formulas)}\n")
    for i, formula in enumerate(all_formulas[:5]):
        # Remove newlines for display
        f_clean = formula.replace('\n', ' ').replace('  ', ' ')[:100]
        print(f"{i+1}. {f_clean}")
    
    # Check if VLOOKUP exists in the file at all
    vlookup_in_file = 'VLOOKUP' in s1
    print(f"\nVLOOKUP text appears in file: {vlookup_in_file}")
    
    # Count VLOOKUP occurrences
    vlookup_count = s1.count('VLOOKUP')
    print(f"VLOOKUP occurrences: {vlookup_count}")
    
    # Show where first VLOOKUP appears
    vlookup_pos = s1.find('VLOOKUP')
    if vlookup_pos > -1:
        start = max(0, vlookup_pos - 100)
        end = min(len(s1), vlookup_pos + 200)
        print(f"\nContext around first VLOOKUP (pos {vlookup_pos}):")
        print(s1[start:end])
