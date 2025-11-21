import psycopg2

conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
cur = conn.cursor()

cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'projects' 
    ORDER BY ordinal_position
""")

cols = cur.fetchall()
if cols:
    print('Projects table columns:')
    for c in cols:
        print(f'  - {c[0]}')
else:
    print('Projects table does NOT exist')

cur.close()
conn.close()
