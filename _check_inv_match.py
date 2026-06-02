import psycopg2, psycopg2.extras, csv, uuid
from datetime import datetime

conn = psycopg2.connect(
    host='aws-1-eu-west-1.pooler.supabase.com',
    port=5432,
    dbname='postgres',
    user='postgres.fojbzghphznbslqwurrm',
    password='fulebimojviT1985%',
    sslmode='require'
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Get all dimensions
cur.execute('SELECT uuid, dimension FROM dimensions')
dims = {r['dimension']: r['uuid'] for r in cur.fetchall()}
print('All dimensions in DB:')
for name, uid in sorted(dims.items()): print(f'  {uid} | {name}')

print()
# Get all inventory_groups
cur.execute('SELECT uuid, name FROM inventory_groups')
groups_db = {r['name']: r['uuid'] for r in cur.fetchall()}
print(f'Total groups in DB: {len(groups_db)}')

print()
# Load CSV and see what we'd match
with open('MI_Models - MI_Models.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

active = [r for r in rows if not r['Deleted'].strip()]
print(f'Active items to import: {len(active)}')

# Dimension matching
csv_units = set(r['ზომის ერთეული -'].strip() for r in active)
print('\nCSV units vs DB dimensions:')
for u in sorted(csv_units):
    match = dims.get(u, 'MISSING')
    print(f'  {"✓" if u in dims else "✗"} {u!r} -> {match}')

# Group name matching (CSV format: "GroupName | DimensionName")
csv_groups = set(r['სასაქონლო ჯგუფი :'].strip() for r in active)
csv_group_names = set(g.split(' | ')[0].strip() for g in csv_groups)
print(f'\nCSV distinct groups: {len(csv_groups)} (stripped names: {len(csv_group_names)})')
missing_groups = [n for n in csv_group_names if n not in groups_db]
print(f'Groups NOT in DB: {len(missing_groups)}')
for g in sorted(missing_groups)[:20]: print(f'  MISSING: {g!r}')

cur.close()
conn.close()
