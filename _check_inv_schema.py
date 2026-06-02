import psycopg2, psycopg2.extras
conn = psycopg2.connect(host='aws-1-eu-west-1.pooler.supabase.com',port=5432,dbname='postgres',user='postgres.fojbzghphznbslqwurrm',password='fulebimojviT1985%',sslmode='require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%insider%'")
print('Tables with insider:', [r['table_name'] for r in cur.fetchall()])

cur.execute("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='inventories' ORDER BY ordinal_position")
print('\ninventories columns:')
for r in cur.fetchall(): print(' ', r['column_name'], 'nullable:', r['is_nullable'])

conn.close()
