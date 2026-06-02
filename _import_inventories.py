"""
Import all active items from MI_Models CSV into inventories table.
"""
import psycopg2, psycopg2.extras, csv, uuid
from datetime import datetime

INSIDER_UUID = '2a55debb-261b-4ce9-bae4-296ddea037ab'

conn = psycopg2.connect(
    host='aws-1-eu-west-1.pooler.supabase.com',
    port=5432,
    dbname='postgres',
    user='postgres.fojbzghphznbslqwurrm',
    password='fulebimojviT1985%',
    sslmode='require'
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
conn.autocommit = False

with open('MI_Models - MI_Models.csv', encoding='utf-8-sig') as f:
    all_rows = list(csv.DictReader(f))

active = [r for r in all_rows if not r['Deleted'].strip()]
print(f'Active rows: {len(active)}')

cur.execute('SELECT uuid, dimension FROM dimensions')
dim_map = {r['dimension']: r['uuid'] for r in cur.fetchall()}

cur.execute('SELECT uuid, name FROM inventory_groups')
grp_map = {r['name']: r['uuid'] for r in cur.fetchall()}

csv_grp_dim = {}
for r in active:
    full = r['sasaqonlo jgufi :'.replace('sasaqonlo jgufi :', 'სასაქონლო ჯგუფი :')].strip()
    parts = full.split(' | ')
    if len(parts) >= 2:
        g = parts[0].strip(); d = parts[-1].strip()
        if g not in csv_grp_dim: csv_grp_dim[g] = d

MISSING = ['გამოძახების პანელი ღილაკებით ციფრუილ ეკრანით ორი ლიფტის','გამოძახების პანელის დისფლეი','ესკალარორის კვების ბლოკი','კარის უსაფრხოების კომუნიკაციის ბოქსი','ლივტის კარების ძრავი','სამანქანოს გარეშე ლივტის მართვის ბლოკი ეკრანით']
for name in MISSING:
    if name not in grp_map:
        dn = csv_grp_dim.get(name,'ცალი'); du = dim_map.get(dn) or dim_map['ცალი']
        nu = str(uuid.uuid4())
        cur.execute('INSERT INTO inventory_groups (uuid,name,dimension_uuid,is_active) VALUES (%s,%s,%s,TRUE)', (nu,name,du))
        grp_map[name]=nu; print(f'  group: {name}')

def is_guid(s): p=s.split('-'); return len(p)==5 and len(p[0])==8

seen=set(); recs=[]; dups=0
for r in active:
    g = r['საქონელი_GUID/'].strip().lower()
    iu = str(uuid.uuid4()) if g in seen else g
    if g in seen: dups+=1
    else: seen.add(g)
    gn = r['სასაქონლო ჯგუფი :'].strip().split(' | ')[0].strip()
    grp_u = None if is_guid(gn) else grp_map.get(gn)
    dim_u = dim_map.get(r['ზომის ერთეული -'].strip())
    prod_u = r['მწარმოებელი_GUID'].strip().lower() or None
    nonbal = r['გარებალანსური :'].strip().lower()=='yes'
    capex = r['Oris Capex'].strip().upper()=='TRUE'
    try: cat = datetime.strptime(r['Timestamp'].strip(),'%m/%d/%Y %H:%M:%S')
    except: cat = None
    recs.append((iu,r['მოდელი :'].strip(),prod_u,INSIDER_UUID,grp_u,dim_u,r['შიდა # -'].strip(),nonbal,capex,cat))

print(f'Records: {len(recs)}, dup GUIDs reassigned: {dups}')

for i in range(0,len(recs),500):
    b=recs[i:i+500]
    psycopg2.extras.execute_values(cur,
        'INSERT INTO inventories (uuid,name,producer_uuid,insider_uuid,inventory_group_uuid,dimension_uuid,internal_number,is_nonbalance,is_capex,is_active,created_at) VALUES %s ON CONFLICT (uuid) DO NOTHING',
        [(x[0],x[1],x[2],x[3],x[4],x[5],x[6],x[7],x[8],True,x[9]) for x in b], page_size=500)
    print(f'  batch {i//500+1} done ({i+len(b)} rows)')

conn.commit()
cur.execute('SELECT COUNT(*) as c FROM inventories'); print(f'Final count: {cur.fetchone()[0]}')
cur.close(); conn.close()
