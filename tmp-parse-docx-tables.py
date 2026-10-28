import zipfile
import xml.etree.ElementTree as ET
import re
from pathlib import Path

DOCX = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
}

with zipfile.ZipFile(DOCX, 'r') as z:
    xml = z.read('word/document.xml')

root = ET.fromstring(xml)

def cell_text(tc):
    ts = tc.findall('.//w:t', ns)
    return ''.join((t.text or '') for t in ts).strip()

job_pat = re.compile(r'\b(?:PL\d{1,2}|SL\d{1,2}|S\d{1,2}|P\d{4}|L\d{4})\b', re.IGNORECASE)

all_tables = root.findall('.//w:tbl', ns)
print('TOTAL_TABLES', len(all_tables))

match_tables = 0
for ti, tbl in enumerate(all_tables):
    rows = []
    tbl_codes = set()
    for tr in tbl.findall('./w:tr', ns):
        cells = [cell_text(tc) for tc in tr.findall('./w:tc', ns)]
        # keep row if has any non-empty content
        if any(cells):
            rows.append(cells)
        row_text = ' | '.join(cells)
        for m in job_pat.findall(row_text):
            tbl_codes.add(m.upper())

    if tbl_codes:
        match_tables += 1
        print(f"\n=== TABLE {ti} ===")
        print('CODES', sorted(tbl_codes))
        print('ROWS', len(rows))
        # print all rows with indexes for manual mapping
        for ri, r in enumerate(rows):
            # trim very long cells for readability
            rr = []
            for c in r:
                c2 = c.replace('\n', ' ').strip()
                rr.append(c2 if len(c2) <= 180 else c2[:180] + '...')
            print(f"R{ri}:", ' || '.join(rr))

print('\nMATCH_TABLES', match_tables)
