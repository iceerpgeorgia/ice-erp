import zipfile
import xml.etree.ElementTree as ET
import re
from pathlib import Path

DOCX = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

with zipfile.ZipFile(DOCX, 'r') as z:
    xml = z.read('word/document.xml')
root = ET.fromstring(xml)

def cell_text(tc):
    ts = tc.findall('.//w:t', ns)
    return ''.join((t.text or '') for t in ts).strip()

job_pat = re.compile(r'\b(?:PL\d{1,2}|SL\d{1,2}|S\d{1,2}|P\d{4}|L\d{4})\b', re.IGNORECASE)

def norm_spaces(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()

jobs = {}

for tbl in root.findall('.//w:tbl', ns):
    rows = []
    for tr in tbl.findall('./w:tr', ns):
        cells = [norm_spaces(cell_text(tc)) for tc in tr.findall('./w:tc', ns)]
        if any(cells):
            rows.append(cells)
    if not rows:
        continue

    # find candidate header row that includes "::" and job code
    title_row = None
    title_codes = []
    for r in rows[:5]:
        joined = ' || '.join(r)
        if '::' in joined:
            found = [m.upper() for m in job_pat.findall(joined)]
            if found:
                title_row = joined
                title_codes = found
                break

    if not title_codes:
        continue

    # pick specific job from the part after last :: if possible
    specific = None
    if title_row and '::' in title_row:
        tail = title_row.split('::')[-1]
        ff = [m.upper() for m in job_pat.findall(tail)]
        if ff:
            specific = ff[0]

    code = specific or title_codes[-1]
    if code not in jobs:
        jobs[code] = {
            'job_name': code,
            'floors': None,
            'weight': None,
            'is_ff': False,
            'selling_price': None,
            'service_state': 'Active',
            'factory_no': None,
            'evidence': []
        }

    # heuristics from table rows
    # floors: count numeric floor rows between 1..50 where first cell is floor level
    floor_count = 0
    for r in rows:
        if not r:
            continue
        lead = r[0]
        if re.match(r'^(\d+|\d+\(main\))$', lead, re.IGNORECASE):
            floor_count += 1
    if floor_count and jobs[code]['floors'] is None:
        jobs[code]['floors'] = floor_count

    # weight/capacity tokens in this table text
    joined_all = ' || '.join(' || '.join(r) for r in rows)
    caps = re.findall(r'\b(630|1000|1250|1600|2000|2220)\b\s*(?:KG|кг)?', joined_all, re.IGNORECASE)
    if caps:
        # prefer first realistic capacity token
        jobs[code]['weight'] = int(caps[0])

    # machine room / ff proxy
    if re.search(r'without\s+machinery\s+room|GEN\s*2', joined_all, re.IGNORECASE):
        jobs[code]['is_ff'] = False

    # prices in USD style
    prices = re.findall(r'\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)', joined_all)
    if prices:
        # pick first in this table
        p = float(prices[0].replace(',', ''))
        jobs[code]['selling_price'] = p

    jobs[code]['evidence'].append({'title': title_row[:220], 'rows': len(rows)})

# Output compact mapping
print('JOB_MAP_COUNT', len(jobs))
for k in sorted(jobs):
    j = jobs[k]
    print(f"{k}\t floors={j['floors']}\t weight={j['weight']}\t ff={j['is_ff']}\t price={j['selling_price']}\t rows={j['evidence'][0]['rows'] if j['evidence'] else 0}")
