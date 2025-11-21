import psycopg2

conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'financial_codes' 
    ORDER BY ordinal_position
""")

print("Financial codes table columns:")
for row in cur.fetchall():
    print(f"  {row[0]:<30} {row[1]:<20} NULL: {row[2]}")

cur.execute("SELECT * FROM financial_codes LIMIT 1")
print(f"\nColumn names from SELECT *: {[desc[0] for desc in cur.description]}")
