import psycopg2, psycopg2.extras, csv, uuid
from datetime import datetime

INSIDER_UUID = '2a55debb-261b-4ce9-bae4-296ddea037ab'

conn = psycopg2.connect(host='aws-1-eu-west-1.pooler.supabase.com',port=5432,dbname='postgres',user='postgres.fojbzghphznbslqwurrm',password='fulebimojviT1985%',sslmode='require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
conn.autocommit = False

with open('MI_Models - MI_Models.csv', encoding='utf-8-sig') as f:
    all_rows = list(csv.DictReader(f))
active = [r for r in all_rows if not r['Deleted'].strip()]
print('Active rows:', len(active))

cur.execute('SELECT uuid, dimension FROM dimensions')
dim_map = {r['dimension']: r['uuid'] for r in cur.fetchall()}
cur.execute('SELECT uuid, name FROM inventory_groups')
grp_map = {r['name']: r['uuid'] for r in cur.fetchall()}

csv_grp_dim = {}
for r in active:
    full = r[chr(4ase) + chr(4ag) + chr(4a5) + chr(4a1) + chr(4ae) + chr(4a7) + chr(4d7) + chr(4ef) + chr(4d3) + chr(4e3) + chr(4e4) + chr(4d8) + ' :'.strip()]
