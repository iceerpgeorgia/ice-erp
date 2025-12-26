import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

sql = open('scripts/create-payment-duplicates-table.sql').read()
cur.execute(sql)
conn.commit()

print('✅ Table payment_id_duplicates created successfully')

cur.close()
conn.close()
