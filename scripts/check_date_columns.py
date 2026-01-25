import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# Check date columns in raw table
cursor.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000' 
    AND column_name LIKE '%date%' 
    ORDER BY column_name
""")
cols = cursor.fetchall()

print('Date columns in bog_gel_raw_893486000:')
for c in cols:
    print(f'  - {c[0]}')

cursor.close()
conn.close()
