import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT prosrc FROM pg_proc WHERE proname = 'generate_payment_id'")
result = cur.fetchone()
if result:
    print("Current generate_payment_id function:")
    print("=" * 80)
    print(result[0])
else:
    print("Function not found")

cur.close()
conn.close()
