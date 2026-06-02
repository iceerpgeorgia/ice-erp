import psycopg2, psycopg2.extras

conn = psycopg2.connect(
    host='aws-1-eu-west-1.pooler.supabase.com',
    port=5432,
    dbname='postgres',
    user='postgres.fojbzghphznbslqwurrm',
    password='fulebimojviT1985%',
    sslmode='require'
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check inventory_groups
cur.execute('SELECT uuid, name FROM inventory_groups LIMIT 5')
print('inventory_groups sample:')
for r in cur.fetchall(): print(' ', r['uuid'], '|', r['name'][:50])
cur.execute('SELECT COUNT(*) FROM inventory_groups')
print(' total:', cur.fetchone()['count'])

print()
# Check dimensions table
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='dimensions'")
exists = cur.fetchone()
print('dimensions table exists:', exists is not None)
if exists:
    cur.execute('SELECT COUNT(*) FROM dimensions')
    print('dimensions count:', cur.fetchone()['count'])
    cur.execute('SELECT uuid, dimension FROM dimensions LIMIT 10')
    for r in cur.fetchall(): print(' ', r['uuid'], '|', r['dimension'])

print()
# Check inventories existing rows
cur.execute('SELECT COUNT(*) FROM inventories')
print('inventories existing rows:', cur.fetchone()['count'])

cur.close()
conn.close()
