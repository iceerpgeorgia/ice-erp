import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

# List all bog_gel_raw tables
cursor.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'bog_gel_raw%' 
    ORDER BY tablename
""")
tables = cursor.fetchall()

print('BOG GEL Raw tables:')
for t in tables:
    print(f'  - {t[0]}')

cursor.close()
conn.close()
