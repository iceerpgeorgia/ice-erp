import psycopg2

conn = psycopg2.connect('dbname=iceerpgeorgia user=postgres password=postgres host=localhost')
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='consolidated_bank_accounts' 
    ORDER BY ordinal_position
""")

print("Columns in consolidated_bank_accounts:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

conn.close()
