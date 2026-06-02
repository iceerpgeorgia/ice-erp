"""
Audit rs_waybills_in_api DB records against 'RS Waybills.csv' portal export.

Checks:
  1. Records in CSV missing from DB
  2. Records in DB (in CSV activation date range) missing from CSV
  3. Field-level mismatches for matched records
"""

import csv
import re
import sys
import psycopg2
from datetime import datetime
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CSV_FILE = "RS Waybills.csv"
DB_DSN = "host=db.fojbzghphznbslqwurrm.supabase.co user=postgres password=fulebimojviT1985% dbname=postgres"

# CSV column names (verified)
C_WB_NO        = 'ზედნადები'
C_STATUS       = 'სტATUSი'      # will use index 1
C_CONDITION    = 'მდGОМАREОBA' # will use index 2
C_CATEGORY     = 'კАТЕGОРIA'   # will use index 3
C_TYPE         = 'ТИPи'         # will use index 4
C_ORG          = 'ОRGАНIЗАЦиА' # will use index 5
C_SUM          = 'ТНАНЗА'       # will use index 6
C_DRIVER       = 'mzdGОЛИ'      # will use index 7
C_VEHICLE      = 'АВТо'         # will use index 8
C_TRANS_SUM    = 'ТRАНСп тАНЗА' # will use index 9
C_DEP_ADDR     = 'ТRАНСОрт. dАЧВЯБА'  # index 10
C_SHP_ADDR     = 'mIWОDEBIS АDGILI'   # index 11
C_ACT_TIME     = 'gAAктивINA тАR.'      # index 12
C_TRANS_BEGIN  = 'ТRАНСp. dАЧВЯБА'    # index 13
C_SUBMIT_TIME  = 'чАБАREBIS тАR.'      # index 14
C_CANCEL_TIME  = 'GAUQMEBIS тАR.'      # index 15
C_NOTE         = 'шАНИшВНА'            # index 16
C_VAT_DOC      = 'А/Ф ИД'              # index 17
C_STAT         = 'STАТ'                # index 18
C_TRANS_COST   = 'ТRANSPОрТИREBА хАRЖИ'  # index 19
C_RS_ID        = 'ИД'                  # index 20

GEO_MONTHS = {
    'იAN': 1, 'ТЕB': 2, 'МАR': 3, 'АPR': 4, 'МАИ': 5, 'ИВN': 6,
    'ИВL': 7, 'АGВ': 8, 'СЕK': 9, 'ОKТ': 10, 'НОЕ': 11, 'DЕK': 12,
}

# ---------------------------------------------------------------------------
# Helpers (use index-based access for robustness)
# ---------------------------------------------------------------------------

def row_by_index(row: dict, idx: int):
    """Access CSV row value by column index (robust to name encoding issues)."""
    keys = list(row.keys())
    if idx < len(keys):
        return row[keys[idx]] or ''
    return ''

def parse_geo_date(s: str) -> str | None:
    """Parse '26-მАИ-2026 12:33:01' → '2026-05-26' (date only)."""
    if not s or not s.strip():
        return None
    # Try pattern: dd-XXX-yyyy
    m = re.match(r'(\d{1,2})-(.{3,5})-(\d{4})', s.strip())
    if not m:
        return None
    day, mon_str, year = m.group(1), m.group(2), m.group(3)
    # Month lookup: try both Georgian and encoded variants
    month = None
    for geo, num in GEO_MONTHS.items():
        pass  # We'll use a universal approach below
    # Map 3-char month codes (Georgian months displayed in PowerShell vary)
    # Use ordinal-based approach: just trust the position
    return None  # Will be filled per actual values

def parse_date_str(s: str) -> str | None:
    """Parse Georgian date like '26-მАИ-2026' or '2026-05-26' → date string."""
    if not s or not s.strip():
        return None
    s = s.strip()
    # Try ISO format first
    m = re.match(r'(\d{4}-\d{2}-\d{2})', s)
    if m:
        return m.group(1)
    # Georgian portal format: dd-XXX-yyyy
    m = re.match(r'(\d{1,2})-(\S+)-(\d{4})', s)
    if not m:
        return None
    day_s, mon_str, year_s = m.group(1), m.group(2), m.group(3)
    # Map using character offsets (the month names are Georgian, encoding may vary)
    # We hash the 3-char prefix to month number using known data
    # Known: first row shows '26-მАИ-2026' for May 26, 2026
    # Georgian months: იAN=1 ТЕB=2 МАR=3 АPR=4 МАИ=5 ИВН=6 ИВЛ=7 АГВ=8 СЕК=9 ОКТ=10 НОЕ=11 ДЕК=12
    geo_month_map = {
        '\u10d8\u10d0\u10dc': 1,  # იAN
        '\u10d7\u10d4\u10d1': 2,  # ТЕB
        '\u10db\u10d0\u10e0': 3,  # МАR
        '\u10d0\u10de\u10e0': 4,  # АPR
        '\u10db\u10d0\u10d8': 5,  # МАИ
        '\u10d8\u10d5\u10dc': 6,  # ИВН
        '\u10d8\u10d5\u10da': 7,  # ИВЛ
        '\u10d0\u10d2\u10d5': 8,  # АГВ
        '\u10e1\u10d4\u10e5': 9,  # СЕК
        '\u10dd\u10e5\u10e2': 10, # ОКТ
        '\u10dc\u10dd\u10d4': 11, # НОЕ
        '\u10d3\u10d4\u10d9': 12, # ДЕК
    }
    # Try first 3 chars of month string
    key3 = mon_str[:3] if len(mon_str) >= 3 else mon_str
    month = geo_month_map.get(key3)
    if not month:
        return None
    return f"{year_s}-{month:02d}-{int(day_s):02d}"

def normalize_amount(s) -> str:
    if s is None:
        return '0.00'
    try:
        return f"{float(str(s).replace(',', '.')):.2f}"
    except (ValueError, TypeError):
        return str(s).strip()

# ---------------------------------------------------------------------------
# Load CSV
# ---------------------------------------------------------------------------

csv_rows = []
with open(CSV_FILE, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        csv_rows.append(row)

# Validate: confirm column order
first_keys = list(csv_rows[0].keys()) if csv_rows else []
assert len(first_keys) == 21, f"Expected 21 columns, got {len(first_keys)}: {first_keys}"

# Access by index
csv_by_rs_id = {}
for row in csv_rows:
    rs_id = row_by_index(row, 20).strip()  # column 20 = ID
    if rs_id:
        csv_by_rs_id[rs_id] = row

print(f"CSV: {len(csv_rows)} rows, {len(csv_by_rs_id)} unique IDs")

# Date range from CSV activation dates
act_dates = []
for row in csv_rows:
    d = parse_date_str(row_by_index(row, 12))  # col 12 = activation time
    if d:
        act_dates.append(d)
min_date = min(act_dates) if act_dates else None
max_date = max(act_dates) if act_dates else None
print(f"CSV activation date range: {min_date} → {max_date}")

# Inspect distinct type/status/condition values
csv_types = Counter(row_by_index(r, 4).strip() for r in csv_rows)
csv_statuses = Counter(row_by_index(r, 1).strip() for r in csv_rows)
csv_conditions = Counter(row_by_index(r, 2).strip() for r in csv_rows)
print(f"CSV types:      {dict(csv_types)}")
print(f"CSV statuses:   {dict(csv_statuses)}")
print(f"CSV conditions: {dict(csv_conditions)}")

# ---------------------------------------------------------------------------
# Load DB records (for CSV rs_ids)
# ---------------------------------------------------------------------------

rs_ids_list = list(csv_by_rs_id.keys())
conn = psycopg2.connect(DB_DSN)
cur = conn.cursor()

placeholders = ','.join(['%s'] * len(rs_ids_list))
cur.execute(f"""
    SELECT rs_id, waybill_no, state, condition, type, counteragent, sum,
           activation_time, transportation_beginning_time, submission_time,
           cancellation_time, note, stat, departure_address, shipping_address,
           transportation_sum
    FROM rs_waybills_in_api
    WHERE rs_id IN ({placeholders})
""", rs_ids_list)

db_by_rs_id = {}
cols = [d[0] for d in cur.description]
for row in cur.fetchall():
    r = dict(zip(cols, row))
    db_by_rs_id[r['rs_id']] = r

print(f"\nDB: {len(db_by_rs_id)} matched records (of {len(rs_ids_list)} CSV IDs)")

# DB type distribution for matched records
db_types_matched = Counter(r['type'] or '' for r in db_by_rs_id.values())
db_statuses_matched = Counter(r['state'] or '' for r in db_by_rs_id.values())
db_conds_matched = Counter(r['condition'] or '' for r in db_by_rs_id.values())
print(f"DB types (matched):      {dict(db_types_matched)}")
print(f"DB statuses (matched):   {dict(db_statuses_matched)}")
print(f"DB conditions (matched): {dict(db_conds_matched)}")

# DB records in date range not in CSV
if min_date and max_date:
    cur.execute(f"""
        SELECT rs_id, waybill_no, state, type, activation_time, sum
        FROM rs_waybills_in_api
        WHERE activation_time >= %s AND activation_time < (%s::date + interval '1 day')
          AND rs_id NOT IN ({placeholders})
        ORDER BY activation_time
    """, [min_date, max_date] + rs_ids_list)
    extra_in_db = cur.fetchall()
else:
    extra_in_db = []

cur.close()
conn.close()

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

print("\n" + "=" * 70)
print("AUDIT RESULTS")
print("=" * 70)

# 1. CSV records missing from DB
missing_from_db = [rs_id for rs_id in csv_by_rs_id if rs_id not in db_by_rs_id]
print(f"\n[1] In CSV, NOT in DB: {len(missing_from_db)}")
for rs_id in sorted(missing_from_db):
    r = csv_by_rs_id[rs_id]
    wb = row_by_index(r, 0)
    status = row_by_index(r, 1)
    typ = row_by_index(r, 4)
    act = row_by_index(r, 12)
    print(f"  rs_id={rs_id}  waybill={wb}  status={status!r}  type={typ!r}  activated={act}")

# 2. DB records in range but not in CSV
print(f"\n[2] In DB (same date range), NOT in CSV: {len(extra_in_db)}")
for row in extra_in_db:
    rs_id, wb_no, state, typ, act_time, total = row
    act_str = act_time.strftime('%Y-%m-%d %H:%M') if act_time else ''
    print(f"  rs_id={rs_id}  waybill={wb_no}  status={state!r}  type={typ!r}  activated={act_str}  sum={total}")

# 3. Field mismatches
print(f"\n[3] Field mismatches for {len(db_by_rs_id)} matched records:")

mismatches = []
for rs_id, csv_r in csv_by_rs_id.items():
    db_r = db_by_rs_id.get(rs_id)
    if not db_r:
        continue

    diffs = []

    # waybill_no
    v_csv = row_by_index(csv_r, 0).strip()
    v_db = (db_r['waybill_no'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"waybill_no: CSV={v_csv!r}  DB={v_db!r}")

    # state
    v_csv = row_by_index(csv_r, 1).strip()
    v_db = (db_r['state'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"state: CSV={v_csv!r}  DB={v_db!r}")

    # condition
    v_csv = row_by_index(csv_r, 2).strip()
    v_db = (db_r['condition'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"condition: CSV={v_csv!r}  DB={v_db!r}")

    # type
    v_csv = row_by_index(csv_r, 4).strip()
    v_db = (db_r['type'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"type: CSV={v_csv!r}  DB={v_db!r}")

    # sum
    v_csv = normalize_amount(row_by_index(csv_r, 6))
    v_db = normalize_amount(db_r['sum'])
    if v_csv != v_db:
        diffs.append(f"sum: CSV={v_csv}  DB={v_db}")

    # activation date
    act_csv = parse_date_str(row_by_index(csv_r, 12))
    act_db_raw = db_r['activation_time']
    if act_csv and act_db_raw:
        act_db = act_db_raw.strftime('%Y-%m-%d') if hasattr(act_db_raw, 'strftime') else str(act_db_raw)[:10]
        if act_csv != act_db:
            diffs.append(f"activation_date: CSV={act_csv}  DB={act_db}")
    elif act_csv and not act_db_raw:
        diffs.append(f"activation_date: CSV={act_csv}  DB=NULL")

    # note
    v_csv = row_by_index(csv_r, 16).strip()
    v_db = (db_r['note'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"note: CSV={v_csv!r}  DB={v_db!r}")

    # departure_address
    v_csv = row_by_index(csv_r, 10).strip()
    v_db = (db_r['departure_address'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"departure_address: CSV={v_csv!r}  DB={v_db!r}")

    # shipping_address
    v_csv = row_by_index(csv_r, 11).strip()
    v_db = (db_r['shipping_address'] or '').strip()
    if v_csv != v_db:
        diffs.append(f"shipping_address: CSV={v_csv!r}  DB={v_db!r}")

    if diffs:
        wb_no = row_by_index(csv_r, 0)
        mismatches.append((rs_id, wb_no, diffs))

# Summary by field
field_counts = Counter()
for _, _, diffs in mismatches:
    for d in diffs:
        field = d.split(':')[0]
        field_counts[field] += 1

if not mismatches:
    print("  No field mismatches!")
else:
    print(f"  Records with mismatches: {len(mismatches)}")
    print(f"  By field: {dict(field_counts.most_common())}")
    print()
    for rs_id, wb_no, diffs in mismatches[:40]:
        print(f"  rs_id={rs_id}  waybill={wb_no}")
        for d in diffs:
            print(f"    - {d}")
    if len(mismatches) > 40:
        print(f"  ... and {len(mismatches) - 40} more")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print(f"  CSV records:                {len(csv_rows)}")
print(f"  Matched in DB:              {len(db_by_rs_id)}")
print(f"  In CSV, missing from DB:    {len(missing_from_db)}")
print(f"  In DB (range), not in CSV:  {len(extra_in_db)}")
print(f"  Matched with mismatches:    {len(mismatches)}")


Checks:
  1. Records in CSV missing from DB
  2. Records in DB (filtered to CSV date range) missing from CSV
  3. Field-level mismatches for matching records
"""

import csv
import os
import re
import psycopg2
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CSV_FILE = "RS Waybills.csv"
DB_DSN = "host=db.fojbzghphznbslqwurrm.supabase.co user=postgres password=fulebimojviT1985% dbname=postgres"

# Georgian month abbreviations → numeric month
GEO_MONTHS = {
    'იან': 1, 'თებ': 2, 'მარ': 3, 'აპრ': 4, 'მაი': 5, 'ივნ': 6,
    'ივლ': 7, 'აგვ': 8, 'სექ': 9, 'ოქტ': 10, 'ნოე': 11, 'დეკ': 12,
}

# CSV type label → normalized form for comparison
# These are full-form labels the portal exports
TYPE_NORMALIZE = {
    'ტრანსპ.ებით': 'ტრანსპ.ებით',
    'ტრანსპ.გარეშე': 'ტრანსპ.გარეშე',
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_geo_date(s: str) -> str | None:
    """Parse '26-მაი-2026 12:33:01' → '2026-05-26' (date only for comparison)."""
    if not s or not s.strip():
        return None
    m = re.match(r'(\d{2})-(\S+)-(\d{4})', s.strip())
    if not m:
        return None
    day, mon_str, year = m.group(1), m.group(2), m.group(3)
    month = GEO_MONTHS.get(mon_str[:3])
    if not month:
        return None
    return f"{year}-{month:02d}-{int(day):02d}"

def normalize_amount(s: str) -> str:
    """Normalize amount string for comparison."""
    if not s or not s.strip():
        return '0.00'
    try:
        return f"{float(s.replace(',', '.')):.2f}"
    except ValueError:
        return s.strip()

def normalize_type(s: str) -> str:
    """Normalize type label — strip abbreviations to canonical form."""
    if not s:
        return ''
    s = s.strip()
    # Map CSV abbreviations to our DB labels
    mapping = {
        'ტრანსპ.ებით': 'ტრანსპ.ებით',
        'ტრანსპ. ებით': 'ტრანსპ.ებით',
        'ტრანსპ.გარეშე': 'ტრანსპ.გარეშე',
        'ტრანსპ. გარეშე': 'ტრანსპ.გარეშე',
    }
    return mapping.get(s, s)

# ---------------------------------------------------------------------------
# Load CSV
# ---------------------------------------------------------------------------

csv_rows = []
with open(CSV_FILE, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        csv_rows.append(row)

csv_by_rs_id = {r['ID'].strip(): r for r in csv_rows}
print(f"CSV: {len(csv_rows)} rows, {len(csv_by_rs_id)} unique IDs")

# Collect date range from CSV for DB query
csv_dates = [parse_geo_date(r.get('გააქტიურების თარ.', '')) for r in csv_rows]
csv_dates = [d for d in csv_dates if d]
min_date = min(csv_dates) if csv_dates else None
max_date = max(csv_dates) if csv_dates else None
print(f"CSV activation date range: {min_date} → {max_date}")

# ---------------------------------------------------------------------------
# Load DB records
# ---------------------------------------------------------------------------

conn = psycopg2.connect(DB_DSN)
cur = conn.cursor()

rs_ids_list = list(csv_by_rs_id.keys())
placeholders = ','.join(['%s'] * len(rs_ids_list))

cur.execute(f"""
    SELECT rs_id, waybill_no, state, condition, type, counteragent, sum,
           activation_time, transportation_beginning_time, submission_time,
           cancellation_time, note, stat, departure_address, shipping_address,
           transportation_sum
    FROM rs_waybills_in_api
    WHERE rs_id IN ({placeholders})
""", rs_ids_list)

db_rows = {}
cols = [d[0] for d in cur.description]
for row in cur.fetchall():
    r = dict(zip(cols, row))
    db_rows[r['rs_id']] = r

print(f"DB: {len(db_rows)} matching records found (out of {len(rs_ids_list)} CSV IDs)")

# Also check how many DB records exist in the CSV activation date range
cur.execute("""
    SELECT COUNT(*) FROM rs_waybills_in_api
    WHERE activation_time >= %s AND activation_time < (%s::date + interval '1 day')
""", (min_date, max_date))
total_in_range = cur.fetchone()[0]
print(f"DB: {total_in_range} total records in activation date range {min_date}→{max_date}")

cur.close()
conn.close()

# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

print("\n" + "=" * 70)
print("AUDIT RESULTS")
print("=" * 70)

# 1. CSV records missing from DB
missing_from_db = [rs_id for rs_id in csv_by_rs_id if rs_id not in db_rows]
print(f"\n[1] CSV records NOT in DB: {len(missing_from_db)}")
for rs_id in missing_from_db[:20]:
    r = csv_by_rs_id[rs_id]
    print(f"    {rs_id} | {r['ზედნადები']} | {r['სტატუსი']} | {r['ტიპი']} | {r['გააქტიურების თარ.']}")
if len(missing_from_db) > 20:
    print(f"    ... and {len(missing_from_db) - 20} more")

# 2. DB records in range but not in CSV
# (We need to query DB for records in the date range that aren't in CSV)
conn2 = psycopg2.connect(DB_DSN)
cur2 = conn2.cursor()
cur2.execute(f"""
    SELECT rs_id, waybill_no, state, type, activation_time, sum
    FROM rs_waybills_in_api
    WHERE activation_time >= %s AND activation_time < (%s::date + interval '1 day')
      AND rs_id NOT IN ({placeholders})
    ORDER BY activation_time
""", [min_date, max_date] + rs_ids_list)
extra_in_db = cur2.fetchall()
cur2.close()
conn2.close()

print(f"\n[2] DB records in date range NOT in CSV: {len(extra_in_db)}")
for row in extra_in_db[:20]:
    rs_id, waybill_no, state, typ, act_time, total = row
    act_str = act_time.strftime('%Y-%m-%d') if act_time else ''
    print(f"    {rs_id} | {waybill_no} | {state} | {typ} | {act_str} | {total}")
if len(extra_in_db) > 20:
    print(f"    ... and {len(extra_in_db) - 20} more")

# 3. Field-level mismatches for matching records
print(f"\n[3] Field mismatches for {len(db_rows)} matched records:")

mismatches = []

for rs_id, csv_r in csv_by_rs_id.items():
    db_r = db_rows.get(rs_id)
    if not db_r:
        continue

    diffs = []

    # Waybill number
    csv_wb = csv_r['ზედნადები'].strip()
    db_wb = (db_r['waybill_no'] or '').strip()
    if csv_wb != db_wb:
        diffs.append(f"waybill_no: CSV={csv_wb!r} DB={db_wb!r}")

    # Status / state
    csv_state = csv_r['სტატუსი'].strip()
    db_state = (db_r['state'] or '').strip()
    if csv_state != db_state:
        diffs.append(f"state: CSV={csv_state!r} DB={db_state!r}")

    # Condition (IS_CONFIRMED)
    csv_cond = csv_r['მდგომარეობა'].strip()
    db_cond = (db_r['condition'] or '').strip()
    if csv_cond != db_cond:
        diffs.append(f"condition: CSV={csv_cond!r} DB={db_cond!r}")

    # Type
    csv_type = csv_r['ტიპი'].strip()
    db_type = (db_r['type'] or '').strip()
    if csv_type != db_type:
        diffs.append(f"type: CSV={csv_type!r} DB={db_type!r}")

    # Amount (sum)
    csv_sum = normalize_amount(csv_r['თანხა'])
    db_sum = normalize_amount(str(db_r['sum'] or '0'))
    if csv_sum != db_sum:
        diffs.append(f"sum: CSV={csv_sum} DB={db_sum}")

    # Activation date (compare date part only)
    csv_act_date = parse_geo_date(csv_r.get('გААქტიURების თარ.', '') or csv_r.get('გAAქტIV...', ''))
    # Try different key variants
    for key in ['გААქტ...', 'გAAქтiven...']:
        pass
    csv_act_raw = csv_r.get('გAAქтивации...', '')
    # The actual column name:
    for k in csv_r.keys():
        if 'ააქ' in k or 'ქტი' in k:
            csv_act_raw = csv_r[k]
            break
    csv_act_date = parse_geo_date(csv_act_raw)
    db_act = db_r['activation_time']
    if db_act and csv_act_date:
        db_act_date = db_act.strftime('%Y-%m-%d')
        if csv_act_date != db_act_date:
            diffs.append(f"activation_date: CSV={csv_act_date} DB={db_act_date}")

    # Note
    csv_note = csv_r.get('შენიშვნა', '').strip()
    db_note = (db_r['note'] or '').strip()
    if csv_note != db_note:
        diffs.append(f"note: CSV={csv_note!r} DB={db_note!r}")

    if diffs:
        mismatches.append((rs_id, csv_r['ზედნადები'], diffs))

if not mismatches:
    print("    No field mismatches found!")
else:
    # Group by mismatch type
    from collections import Counter
    field_counts = Counter()
    for _, _, diffs in mismatches:
        for d in diffs:
            field = d.split(':')[0]
            field_counts[field] += 1

    print(f"    Total records with mismatches: {len(mismatches)}")
    print(f"    Mismatch counts by field: {dict(field_counts)}")
    print()
    for rs_id, wb_no, diffs in mismatches[:30]:
        print(f"    {rs_id} | {wb_no}")
        for d in diffs:
            print(f"      - {d}")
    if len(mismatches) > 30:
        print(f"    ... and {len(mismatches) - 30} more")

print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
print(f"  CSV records:              {len(csv_rows)}")
print(f"  Matched in DB:            {len(db_rows)}")
print(f"  Missing from DB:          {len(missing_from_db)}")
print(f"  Extra in DB (same range): {len(extra_in_db)}")
print(f"  Field mismatches:         {len(mismatches)}")
