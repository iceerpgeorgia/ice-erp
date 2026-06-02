"""Audit rs_waybills_in_api DB records against RS Waybills.csv portal export."""
import csv, sys, re, psycopg2
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CSV_FILE = 'RS Waybills.csv'
DB_DSN = 'host=db.fojbzghphznbslqwurrm.supabase.co user=postgres password=fulebimojviT1985% dbname=postgres'

# Georgian month abbrev (first 3 chars) -> month number
GEO_MONTHS = {
    '\u10d8\u10d0\u10dc': 1,  # იAN  Jan
    '\u10d7\u10d4\u10d1': 2,  # თEB  Feb
    '\u10db\u10d0\u10e0': 3,  # მAR  Mar
    '\u10d0\u10de\u10e0': 4,  # APR  Apr
    '\u10db\u10d0\u10d8': 5,  # მAI  May
    '\u10d8\u10d5\u10dc': 6,  # ივN  Jun
    '\u10d8\u10d5\u10da': 7,  # ივL  Jul
    '\u10d0\u10d2\u10d5': 8,  # AGV  Aug
    '\u10e1\u10d4\u10e5': 9,  # სEQ  Sep
    '\u10dd\u10e5\u10e2': 10, # OQT  Oct
    '\u10dc\u10dd\u10d4': 11, # NOE  Nov
    '\u10d3\u10d4\u10d9': 12, # DEK  Dec
}

def parse_date(s):
    """Parse '26-მAI-2026 12:33:01' -> '2026-05-26'."""
    if not s:
        return None
    m = re.match(r'(\d{1,2})-(\S+)-(\d{4})', s.strip())
    if not m:
        return None
    day, mon, year = m.group(1), m.group(2), m.group(3)
    month_num = GEO_MONTHS.get(mon[:3])
    if not month_num:
        return None
    return f'{year}-{month_num:02d}-{int(day):02d}'

def norm_amt(v):
    """Normalize amount to 2dp string."""
    try:
        return f'{float(str(v or 0).replace(",", ".")):,.2f}'
    except (ValueError, TypeError):
        return str(v or '')

def col(row_list, i):
    """Get column value by index."""
    if i < len(row_list):
        return (row_list[i] or '').strip()
    return ''

# ---------------------------------------------------------------------------
# Load CSV (store as lists to avoid key-encoding issues)
# ---------------------------------------------------------------------------
# Column indices (verified):
# 0=waybill_no  1=status  2=condition  3=category  4=type  5=org  6=sum
# 7=driver  8=vehicle  9=trans_sum  10=dep_addr  11=shp_addr  12=act_time
# 13=trans_begin  14=submit_time  15=cancel_time  16=note  17=vat_doc
# 18=stat  19=trans_cost  20=rs_id

rows = []
with open(CSV_FILE, encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        rows.append(list(row.values()))

csv_by_id = {col(r, 20): r for r in rows if col(r, 20)}
print(f'CSV: {len(rows)} rows, {len(csv_by_id)} unique IDs')

act_dates = [parse_date(col(r, 12)) for r in rows]
act_dates = [d for d in act_dates if d]
min_d = min(act_dates) if act_dates else None
max_d = max(act_dates) if act_dates else None
print(f'Activation range: {min_d} -> {max_d}')
print('Types:     ', dict(Counter(col(r, 4) for r in rows)))
print('Statuses:  ', dict(Counter(col(r, 1) for r in rows)))
print('Conditions:', dict(Counter(col(r, 2) for r in rows)))

# ---------------------------------------------------------------------------
# Query DB
# ---------------------------------------------------------------------------
ids = list(csv_by_id.keys())
ph = ','.join(['%s'] * len(ids))
conn = psycopg2.connect(DB_DSN)
cur = conn.cursor()

cur.execute(
    f'SELECT rs_id,waybill_no,state,condition,type,sum,'
    f'activation_time,departure_address,shipping_address,note '
    f'FROM rs_waybills_in_api WHERE rs_id IN ({ph})',
    ids
)
db = {r[0]: r for r in cur.fetchall()}
print(f'\nDB matched: {len(db)} of {len(ids)}')
print('DB types:  ', dict(Counter((r[4] or '') for r in db.values())))
print('DB statuses:', dict(Counter((r[2] or '') for r in db.values())))
print('DB conds:  ', dict(Counter((r[3] or '') for r in db.values())))

# Records in DB within same activation range but NOT in CSV
cur.execute(
    f'SELECT rs_id,waybill_no,state,type,activation_time,sum '
    f'FROM rs_waybills_in_api '
    f'WHERE activation_time >= %s AND activation_time < (%s::date + interval \'1 day\') '
    f'  AND rs_id NOT IN ({ph}) '
    f'ORDER BY activation_time',
    [min_d, max_d] + ids
)
extra = cur.fetchall()
cur.close()
conn.close()

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
print()
print('=' * 65)

# [1] Missing from DB
missing = [i for i in csv_by_id if i not in db]
print(f'[1] In CSV, missing from DB: {len(missing)}')
for i in missing:
    r = csv_by_id[i]
    print(f'  rs_id={i}  wb={col(r,0)}  status={col(r,1)!r}  type={col(r,4)!r}  act={col(r,12)}')

# [2] Extra in DB
print(f'\n[2] In DB (same range), not in CSV: {len(extra)}')
for rs_id, wb, state, typ, at, s in extra:
    at_s = at.strftime('%Y-%m-%d %H:%M') if at else ''
    print(f'  rs_id={rs_id}  wb={wb}  status={state!r}  type={typ!r}  sum={s}  act={at_s}')

# [3] Field mismatches
mismatches = []
for rid, csv_r in csv_by_id.items():
    db_r = db.get(rid)
    if not db_r:
        continue
    diffs = []

    # waybill_no
    if col(csv_r, 0) != (db_r[1] or '').strip():
        diffs.append(f'waybill_no: {col(csv_r,0)!r} vs {db_r[1]!r}')
    # state
    if col(csv_r, 1) != (db_r[2] or '').strip():
        diffs.append(f'state: {col(csv_r,1)!r} vs {db_r[2]!r}')
    # condition
    if col(csv_r, 2) != (db_r[3] or '').strip():
        diffs.append(f'condition: {col(csv_r,2)!r} vs {db_r[3]!r}')
    # type
    if col(csv_r, 4) != (db_r[4] or '').strip():
        diffs.append(f'type: {col(csv_r,4)!r} vs {db_r[4]!r}')
    # sum
    csv_sum = norm_amt(col(csv_r, 6))
    db_sum = norm_amt(db_r[5])
    if csv_sum != db_sum:
        diffs.append(f'sum: {col(csv_r,6)!r} ({csv_sum}) vs {db_r[5]} ({db_sum})')
    # activation date
    d_csv = parse_date(col(csv_r, 12))
    d_db = db_r[6].strftime('%Y-%m-%d') if db_r[6] else None
    if d_csv and d_db and d_csv != d_db:
        diffs.append(f'act_date: {d_csv} vs {d_db}')
    elif d_csv and not d_db:
        diffs.append(f'act_date: {d_csv} vs NULL')
    # note
    if col(csv_r, 16) != (db_r[9] or '').strip():
        diffs.append(f'note: {col(csv_r,16)!r} vs {db_r[9]!r}')

    if diffs:
        mismatches.append((rid, col(csv_r, 0), diffs))

fc = Counter(d.split(':')[0] for _, _, ds in mismatches for d in ds)
print(f'\n[3] Field mismatches: {len(mismatches)} records')
if fc:
    print(f'    By field: {dict(fc.most_common())}')
print()
for rid, wb, diffs in mismatches[:50]:
    print(f'  rs_id={rid}  wb={wb}')
    for d in diffs:
        print(f'    {d}')
if len(mismatches) > 50:
    print(f'  ... +{len(mismatches) - 50} more')

print()
print('=' * 65)
print(f'SUMMARY: CSV={len(rows)}  matched={len(db)}  '
      f'missing_from_db={len(missing)}  extra_in_db={len(extra)}  '
      f'mismatches={len(mismatches)}')
