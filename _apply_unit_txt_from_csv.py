#!/usr/bin/env python3
"""
Fix unit_id=99 items in the DB using UNIT_TXT values directly from the CSV download.
This avoids making 687 API calls for items we already have the correct unit text for.
"""

import csv, os, re, sys
from collections import defaultdict
import psycopg2
import psycopg2.extras

def load_env(path):
    env = {}
    try:
        for line in open(path, encoding='utf-8'):
            line = line.rstrip('\r\n').strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                val = v.strip().strip('"').strip("'").replace('\\r\\n', '').replace('\r', '').strip()
                env[k.strip()] = val
    except FileNotFoundError:
        pass
    return env

env = {}
for f in ['.env.local', '.env.production.local', '.env']:
    env.update(load_env(f))

DB_URL = env.get('DIRECT_DATABASE_URL', '') or re.sub(r'\?.*', '', env.get('DATABASE_URL', ''))
if not DB_URL:
    print('ERROR: DATABASE_URL not found'); sys.exit(1)

conn = psycopg2.connect(DB_URL)
cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur2 = conn.cursor()

def norm_waybill_no(s):
    s = re.sub(r'\D', '', str(s or ''))
    if not s: return None
    if len(s) == 9: return '0' + s
    return s

# Load items CSV
rows = []
with open('RS Waybills Items.csv', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append({k.strip(): (v.strip() if v else '') for k, v in row.items()})

# Build map: (waybill_no, goods_code, goods_name) → unit_txt for unit_id=99 candidates
csv_units = {}
for row in rows:
    wno   = norm_waybill_no(row.get('ზედნადების ნომერი', ''))
    gcode = (row.get('საქონლის კოდი') or '').strip()
    gname = (row.get('საქონლის დასახელება') or '').strip()
    unit  = (row.get('ზომის ერთეული') or '').strip()
    if wno and unit:
        # Store with multiple keys for flexible matching
        csv_units[(wno, gcode, gname)] = unit
        csv_units[(wno, '', gname)]    = unit
        if gcode:
            csv_units[(wno, gcode, '')] = unit

# Load all unit_id=99 DB items
cur.execute("""
    SELECT id, waybill_no, goods_code, goods_name, unit
    FROM rs_waybills_in_items
    WHERE unit_id = '99'
    ORDER BY waybill_no, goods_name
""")
db_items = cur.fetchall()
print(f'Found {len(db_items)} unit_id=99 items in DB')

updates = []
not_found = []

for item in db_items:
    wno   = item['waybill_no'] or ''
    gcode = item['goods_code'] or ''
    gname = item['goods_name'] or ''

    # Try to find matching CSV unit text
    new_unit = (
        csv_units.get((wno, gcode, gname)) or
        csv_units.get((wno, '', gname)) or
        csv_units.get((wno, gcode, '')) or
        None
    )

    if new_unit and new_unit != item['unit']:
        updates.append((new_unit, item['id']))
    elif not new_unit:
        not_found.append(item)

print(f'\nItems to update from CSV : {len(updates)}')
print(f'Items NOT found in CSV  : {len(not_found)}  (require API backfill)')

if updates:
    DRY = '--dry-run' in sys.argv
    if DRY:
        print('\n[DRY RUN] Would update:')
        for new_unit, item_id in updates[:10]:
            print(f'  id={item_id} → unit="{new_unit}"')
    else:
        from psycopg2.extras import execute_batch
        execute_batch(cur2, "UPDATE rs_waybills_in_items SET unit=%s WHERE id=%s", updates, page_size=200)
        conn.commit()
        print(f'\nUpdated {len(updates)} items.')

# Summary of what CSV texts were applied
from collections import Counter
applied_units = Counter(u for u, _ in updates)
print('\nApplied unit texts:')
for unit_txt, cnt in applied_units.most_common():
    print(f'  {cnt:>4}x  "{unit_txt}"')

if not_found:
    print(f'\nItems needing API backfill ({len(not_found)}):')
    for item in not_found[:20]:
        print(f"  wno={item['waybill_no']}  code={item['goods_code']}  name={str(item['goods_name'])[:50]}")

conn.close()
