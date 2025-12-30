import psycopg2

conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM payments')
print(f'Total payments in Supabase: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payment_id_duplicates')
print(f'Duplicate mappings stored: {cur.fetchone()[0]}')

cur.execute('SELECT payment_id, project_uuid::text, counteragent_uuid::text FROM payments LIMIT 3')
print("\nSample records:")
for r in cur.fetchall():
    print(f"  payment_id: {r[0]}, project: {r[1][:8] if r[1] else 'NULL'}..., counteragent: {r[2][:8]}...")

conn.close()
