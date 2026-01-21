"""Check sample DocInformation values"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values

env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean)
cur = conn.cursor()

print("\n" + "="*80)
print("SAMPLE DOCINFORMATION WITH SALARY PAYMENT IDs")
print("="*80 + "\n")

cur.execute("""
    SELECT docinformation 
    FROM bog_gel_raw_893486000 
    WHERE docinformation LIKE '%NP_%_NJ_%_PRL%'
    LIMIT 10
""")

for i, row in enumerate(cur.fetchall(), 1):
    print(f"{i}. {row[0]}")
    print()

conn.close()
