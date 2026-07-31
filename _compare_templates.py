import zipfile
import re

# Check what's in backup vs current
for name, path in [('Backup', 'public/Handover Tamplate New_backup.xlsx'), ('CLEANED', 'public/Handover Tamplate New CLEANED.xlsx'), ('CURRENT', 'public/Handover Tamplate New.xlsx')]:
    try:
        with zipfile.ZipFile(path, 'r') as z:
            s1 = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            # Count VLOOKUP references
            vlookup_count = s1.count('VLOOKUP')
            c4_match = re.search(r'<c r="C4"[^>]*>.*?</c>', s1, re.DOTALL)
            c4_found = c4_match is not None
            
            print(f'{name:10s}: VLOOKUP count = {vlookup_count:2d}, C4 = {str(c4_found):5s}')
            
            if vlookup_count > 0 and not c4_found:
                # Find first cell with VLOOKUP
                cells = re.findall(r'<c r="([A-Z]+\d+)"[^>]*>.*?VLOOKUP', s1, re.DOTALL)
                print(f'            First VLOOKUP cell: {cells[0] if cells else "unknown"}')
    except Exception as e:
        print(f'{name:10s}: ERROR - {e}')
