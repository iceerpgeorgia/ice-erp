import psycopg2, os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')
db_url = os.getenv('DATABASE_URL').split('?')[0]
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%duplicate%' OR table_name LIKE '%payment%')
    ORDER BY table_name
""")

print('Tables related to payments/duplicates:')
for row in cur.fetchall():
    print(f'  - {row[0]}')

conn.close()
