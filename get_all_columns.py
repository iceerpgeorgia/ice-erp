import psycopg2

url = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000' 
    ORDER BY ordinal_position
""")

columns = [row[0] for row in cur.fetchall()]
for col in columns:
    print(col)
    
conn.close()
