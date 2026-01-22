import psycopg2

url = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(url, connect_timeout=30)
cursor = conn.cursor()

cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'bog_gel_raw%'
""")

tables = cursor.fetchall()
print("Raw tables:")
for t in tables:
    print(f"  - {t[0]}")
