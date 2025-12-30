import psycopg2

conn = psycopg2.connect(
    host="aws-0-eu-west-1.pooler.supabase.com",
    port=6543,
    database="postgres",
    user="postgres.qfumxlljjnlokimsizog",
    password="iceerp20241224"
)

with open('scripts/fix-payment-record-uuid.sql', 'r') as f:
    sql = f.read()

cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()

print("✅ Trigger function updated successfully!")
