#!/usr/bin/env python3
"""
Compare RS Waybills.csv and RS Waybills Items.csv against the local database.
Outputs a concise gap/mismatch report.
"""

import csv
import os
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation

import psycopg2
import psycopg2.extras

# ── DB connection ────────────────────────────────────────────────────────────
def load_env(path):
    env = {}
    try:
        for line in open(path, encoding='utf-8'):
            line = line.rstrip('\r\n').strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                val = v.strip().strip('"').strip("'").rstrip('\\r\\n').strip()
                val = val.replace('\\r\\n', '').replace('\r\n', '').replace('\r', '').strip()
                env[k.strip()] = val
    except FileNotFoundError:
        pass
    return env

env = {}
for f in ['.env.local', '.env.production.local', '.env']:
    env.update(load_env(f))

# Prefer DIRECT_DATABASE_URL (no pgbouncer); fall back to DATABASE_URL with pgbouncer stripped
DB_URL = env.get('DIRECT_DATABASE_URL', '') or re.sub(r'\?.*', '', env.get('DATABASE_URL', ''))
if not DB_URL:
    print('ERROR: DATABASE_URL not found'); sys.exit(1)

conn = psycopg2.connect(DB_URL)
cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# ── Georgian month → number ──────────────────────────────────────────────────
GEO_MONTH = {
    'იანვ': 1, 'თებ': 2, 'მარ': 3, 'აპრ': 4, 'მაი': 5, 'ივნ': 6,
    'ივლ': 7, 'აგვ': 8, 'სექ': 9, 'ოქტ': 10, 'ნოე': 11, 'დეკ': 12,
    # full names too just in case
    'იანვარი': 1, 'თებერვალი': 2, 'მარტი': 3, 'აპრილი': 4,
    'მაისი': 5, 'ივნისი': 6, 'ივლისი': 7, 'აგვისტო': 8,
    'სექტემბერი': 9, 'ოქტომბერი': 10, 'ნოემბერი': 11, 'დეკემბერი': 12,
}

def parse_geo_date(s):
    """Parse '26-მაი-2026 12:33:01' → datetime (naive, treated as local/Tbilisi)."""
    s = (s or '').strip()
    if not s:
        return None
    m = re.match(r'(\d{1,2})-([^\d-]+)-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?', s)
    if not m:
        return None
    dd, mon, yyyy = int(m.group(1)), m.group(2).strip(), int(m.group(3))
    hh = int(m.group(4) or 0)
    mi = int(m.group(5) or 0)
    ss = int(m.group(6) or 0)
    mo = GEO_MONTH.get(mon)
    if mo is None:
        return None
    return datetime(yyyy, mo, dd, hh, mi, ss)

def norm_waybill_no(s):
    """Normalize to 10-digit waybill number (add leading zero if 9 digits)."""
    s = re.sub(r'\D', '', str(s or ''))
    if not s:
        return None
    if len(s) == 9:
        return '0' + s
    return s

def to_dec(s):
    try:
        return Decimal(str(s).replace(' ', '').replace(',', '.'))
    except (InvalidOperation, TypeError):
        return None

def parse_inn_from_org(s):
    """Extract INN from '(445414212-დღგ) Name' or '(445414212) Name'."""
    m = re.match(r'\((\d+)(?:-[^)]+)?\)', (s or '').strip())
    return m.group(1) if m else None

# ── Load CSVs ─────────────────────────────────────────────────────────────────
def load_csv(path):
    rows = []
    with open(path, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({k.strip(): (v.strip() if v else '') for k, v in row.items()})
    return rows

print('Loading CSVs ...')
wb_rows   = load_csv('RS Waybills.csv')
item_rows = load_csv('RS Waybills Items.csv')
print(f'  Waybills CSV  : {len(wb_rows):>5} rows')
print(f'  Items CSV     : {len(item_rows):>5} rows')

# ── Load DB data ──────────────────────────────────────────────────────────────
print('\nLoading DB ...')
cur.execute("""
    SELECT rs_id, waybill_no, state, condition, type, sum,
           counteragent_inn, is_confirmed,
           activation_time, create_date
    FROM rs_waybills_in_api
""")
db_waybills = {r['rs_id']: dict(r) for r in cur.fetchall()}

cur.execute("""
    SELECT rs_id, waybill_no, goods_code, goods_name,
           unit, unit_id, quantity, unit_price, total_price
    FROM rs_waybills_in_items
""")
db_items_raw = cur.fetchall()
# key: (waybill_no, goods_code, goods_name) → list of DB items
from collections import defaultdict
db_items_by_waybill = defaultdict(list)
for r in db_items_raw:
    wno = r['waybill_no'] or r['rs_id']
    db_items_by_waybill[wno].append(dict(r))

print(f'  DB waybills   : {len(db_waybills):>5}')
print(f'  DB items      : {len(db_items_raw):>5}')

# ── Unit mapping: CSV full-text → DB abbreviation ─────────────────────────────
# Expected official unit names per get_waybill_units API
UNIT_FULL_TO_ABBR = {
    'ცალი': 'ც', 'ც': 'ც',
    'კილოგრამი': 'კგ', 'კგ': 'კგ',
    'გრამი': 'გ', 'გ': 'გ',
    'ლიტრი': 'ლ', 'ლ': 'ლ',
    'ტონა': 'ტ', 'ტ': 'ტ',
    'სანტიმეტრი': 'სმ', 'სმ': 'სმ',
    'მეტრი': 'მ', 'მ': 'მ',
    'კილომეტრი': 'კმ', 'კმ': 'კმ',
    'კვ.სმ': 'კვ.სმ', 'კვ. სმ': 'კვ.სმ',
    'კვ.მ': 'კვ.მ', 'კვ. მ': 'კვ.მ', 'კვ.მ.': 'კვ.მ',
    'მ³': 'მ³', 'კუბ.მ': 'მ³',
    'მილილიტრი': 'მლ', 'მლ': 'მლ',
    'შეკვრა': 'შეკვ', 'შეკვ': 'შეკვ',
}

# ── Analysis 1: Waybills CSV vs DB ────────────────────────────────────────────
print('\n' + '='*70)
print('WAYBILLS: CSV vs DB')
print('='*70)

csv_rs_ids   = set()
missing_from_db  = []
field_mismatches = []
status_map = {'აქტიური': 'აქტიური', 'დასრულებული': 'დასრულებული',
              'გაუქმებული': 'გაუქმებული', 'შეჩერებული': 'შეჩერებული'}

for row in wb_rows:
    rs_id   = row.get('ID', '').strip()
    wno_csv = norm_waybill_no(row.get('ზედნადები', ''))
    if not rs_id:
        continue
    csv_rs_ids.add(rs_id)

    if rs_id not in db_waybills:
        missing_from_db.append({'rs_id': rs_id, 'waybill_no': wno_csv,
                                 'status': row.get('სტატუსი',''),
                                 'date': row.get('გააქტიურების თარ.','')})
        continue

    db = db_waybills[rs_id]
    mismatches = {}

    # waybill_no
    wno_db = db.get('waybill_no') or ''
    if wno_csv and wno_db and wno_csv != wno_db:
        mismatches['waybill_no'] = f'CSV={wno_csv} DB={wno_db}'

    # status
    status_csv = row.get('სტატუსი', '').strip()
    status_db  = db.get('state', '') or ''
    if status_csv and status_db and status_csv != status_db:
        mismatches['status'] = f'CSV={status_csv} DB={status_db}'

    # sum
    sum_csv = to_dec(row.get('თანხა', ''))
    sum_db  = to_dec(db.get('sum'))
    if sum_csv is not None and sum_db is not None:
        if abs(sum_csv - sum_db) > Decimal('0.02'):
            mismatches['sum'] = f'CSV={sum_csv} DB={sum_db}'

    # is_confirmed / condition
    cond_csv = row.get('მდგომარეობა', '').strip()
    cond_db  = db.get('condition', '') or ''
    if cond_csv and cond_db and cond_csv != cond_db:
        mismatches['condition'] = f'CSV={cond_csv} DB={cond_db}'

    if mismatches:
        field_mismatches.append({'rs_id': rs_id, 'waybill_no': wno_csv, **mismatches})

# waybills in DB but NOT in CSV (from the same period scope is unknown, so just count)
extra_in_db = set(db_waybills.keys()) - csv_rs_ids

print(f'\nCSV waybills           : {len(wb_rows)}')
print(f'Matched in DB          : {len(wb_rows) - len(missing_from_db)}')
print(f'Missing from DB        : {len(missing_from_db)}')
print(f'DB-only waybills       : {len(extra_in_db)}  (may be from different periods)')
print(f'Field mismatches       : {len(field_mismatches)}')

if missing_from_db:
    print('\n--- MISSING FROM DB (first 20) ---')
    for w in missing_from_db[:20]:
        print(f"  rs_id={w['rs_id']}  no={w['waybill_no']}  {w['status']}  {w['date']}")

if field_mismatches:
    print('\n--- FIELD MISMATCHES (first 20) ---')
    for m in field_mismatches[:20]:
        details = {k:v for k,v in m.items() if k not in ('rs_id','waybill_no')}
        print(f"  rs_id={m['rs_id']} no={m['waybill_no']}  {details}")

# ── Analysis 2: Items CSV vs DB ───────────────────────────────────────────────
print('\n' + '='*70)
print('ITEMS: CSV vs DB')
print('='*70)

csv_item_keys = set()
items_missing_from_db = []
unit_mismatches       = []
qty_price_mismatches  = []
unit_full_counts      = defaultdict(int)  # unique full-text units seen in CSV

# Group CSV items by waybill number
csv_items_by_waybill = defaultdict(list)
for row in item_rows:
    wno = norm_waybill_no(row.get('ზედნადების ნომერი', ''))
    if wno:
        csv_items_by_waybill[wno].append(row)
        unit_full_counts[row.get('ზომის ერთეული', '').strip()] += 1

print(f'\nCSV unique waybill nos  : {len(csv_items_by_waybill)}')
print(f'DB unique waybill nos   : {len(db_items_by_waybill)}')

# Per-waybill comparison
missing_item_waybills = []
for wno, csv_items in csv_items_by_waybill.items():
    db_items = db_items_by_waybill.get(wno, [])
    if not db_items:
        missing_item_waybills.append({'waybill_no': wno, 'count': len(csv_items)})
        continue

    # Build lookup by goods_code+name
    db_lookup = {}
    for di in db_items:
        key = (di.get('goods_code') or '', di.get('goods_name') or '')
        db_lookup.setdefault(key, []).append(di)

    for ci in csv_items:
        gcode = (ci.get('საქონლის კოდი') or '').strip()
        gname = (ci.get('საქონლის დასახელება') or '').strip()
        key   = (gcode, gname)

        matches = db_lookup.get(key)
        if not matches:
            # try by name only
            matches = db_lookup.get(('', gname)) or db_lookup.get((gcode, ''))
        if not matches:
            items_missing_from_db.append({'waybill_no': wno, 'goods_code': gcode,
                                           'goods_name': gname[:50]})
            continue

        di = matches[0]
        unit_csv_full = (ci.get('ზომის ერთეული') or '').strip()
        unit_db       = (di.get('unit') or '').strip()
        unit_id_db    = (di.get('unit_id') or '').strip()

        # Map CSV full name → expected abbreviation
        expected_abbr = UNIT_FULL_TO_ABBR.get(unit_csv_full)

        # For unit_id=99 items, the CSV unit IS the custom text → compare directly
        if unit_id_db == '99':
            # DB should now store 'სხვ' (placeholder). CSV has the real text.
            if unit_db == 'სხვ' or unit_db != unit_csv_full:
                unit_mismatches.append({
                    'waybill_no': wno, 'goods_code': gcode,
                    'goods_name': gname[:40],
                    'unit_id': '99',
                    'csv_unit': unit_csv_full,
                    'db_unit': unit_db,
                    'note': 'ID=99 custom unit needs backfill'
                })
        elif expected_abbr and unit_db != expected_abbr:
            unit_mismatches.append({
                'waybill_no': wno, 'goods_code': gcode,
                'goods_name': gname[:40],
                'unit_id': unit_id_db,
                'csv_unit': unit_csv_full,
                'db_unit': unit_db,
                'expected_abbr': expected_abbr
            })
        elif not expected_abbr and unit_csv_full:
            # Unknown mapping — just record
            unit_mismatches.append({
                'waybill_no': wno, 'goods_code': gcode,
                'goods_name': gname[:40],
                'unit_id': unit_id_db,
                'csv_unit': unit_csv_full,
                'db_unit': unit_db,
                'note': 'unknown unit mapping'
            })

        # Quantity / price check
        qty_csv   = to_dec(ci.get('რაოდ.'))
        qty_db    = to_dec(di.get('quantity'))
        price_csv = to_dec(ci.get('საქონლის ფასი'))
        price_db  = to_dec(di.get('total_price'))
        issues = {}
        if qty_csv is not None and qty_db is not None and abs(qty_csv - qty_db) > Decimal('0.001'):
            issues['qty'] = f'CSV={qty_csv} DB={qty_db}'
        if price_csv is not None and price_db is not None and abs(price_csv - price_db) > Decimal('0.01'):
            issues['total_price'] = f'CSV={price_csv} DB={price_db}'
        if issues:
            qty_price_mismatches.append({'waybill_no': wno, 'goods_name': gname[:40], **issues})

print(f'Items missing waybills  : {len(missing_item_waybills)}  (waybills with no items in DB)')
print(f'Individual missing items: {len(items_missing_from_db)}')
print(f'Unit mismatches         : {len(unit_mismatches)}')
print(f'Qty/price mismatches    : {len(qty_price_mismatches)}')

if missing_item_waybills:
    print(f'\n--- WAYBILLS WITH NO ITEMS IN DB (first 15) ---')
    for w in missing_item_waybills[:15]:
        print(f"  waybill_no={w['waybill_no']}  ({w['count']} items)")

if items_missing_from_db:
    print(f'\n--- INDIVIDUAL MISSING ITEMS (first 15) ---')
    for i in items_missing_from_db[:15]:
        print(f"  {i['waybill_no']} | {i['goods_code']} | {i['goods_name']}")

# Separate ID=99 unit issues from real mapping issues
id99_issues     = [u for u in unit_mismatches if u.get('unit_id') == '99']
mapping_issues  = [u for u in unit_mismatches if u.get('unit_id') != '99']
unknown_issues  = [u for u in mapping_issues if u.get('note') == 'unknown unit mapping']
real_mismatches = [u for u in mapping_issues if u.get('note') != 'unknown unit mapping']

if real_mismatches:
    print(f'\n--- UNIT MAPPING MISMATCHES (non-99, first 15) ---')
    for u in real_mismatches[:15]:
        print(f"  wno={u['waybill_no']} id={u['unit_id']} CSV='{u['csv_unit']}' DB='{u['db_unit']}' expected='{u.get('expected_abbr','')}'")

if unknown_issues:
    # Summarize unknown units
    from collections import Counter
    unk_cnt = Counter(f"CSV='{u['csv_unit']}' DB='{u['db_unit']}' id={u['unit_id']}" for u in unknown_issues)
    print(f'\n--- UNKNOWN UNIT MAPPINGS (CSV unit not in our map) ---')
    for combo, cnt in unk_cnt.most_common(20):
        print(f'  {cnt:>4}x  {combo}')

if id99_issues:
    from collections import Counter
    id99_csv_units = Counter(u['csv_unit'] for u in id99_issues)
    print(f'\n--- ID=99 CUSTOM UNITS (CSV shows real text, DB has placeholder) ---')
    print(f'  Total items: {len(id99_issues)}')
    print('  Distribution:')
    for unit_txt, cnt in id99_csv_units.most_common(20):
        print(f'    {cnt:>4}x  "{unit_txt}"')

if qty_price_mismatches:
    print(f'\n--- QTY/PRICE MISMATCHES (first 10) ---')
    for m in qty_price_mismatches[:10]:
        print(f"  {m['waybill_no']} | {m['goods_name']} | {m}")

# ── Analysis 3: Full unit distribution in CSV ─────────────────────────────────
print('\n' + '='*70)
print('UNIT DISTRIBUTION IN CSV')
print('='*70)
for unit_txt, cnt in sorted(unit_full_counts.items(), key=lambda x: -x[1]):
    abbr = UNIT_FULL_TO_ABBR.get(unit_txt, '???')
    print(f'  {cnt:>5}x  "{unit_txt}"  →  abbr="{abbr}"')

print('\nDone.')
conn.close()
