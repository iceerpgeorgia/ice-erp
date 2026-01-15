import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM parsing_scheme_rules')
count = cursor.fetchone()[0]
print(f'Total rules in database: {count}')

cursor.execute('SELECT id, LEFT(condition, 60) FROM parsing_scheme_rules ORDER BY id DESC LIMIT 10')
rows = cursor.fetchall()
print('\nLatest 10 rules:')
for r in rows:
    print(f'  ID {r[0]}: {r[1]}...')

cursor.close()
conn.close()
