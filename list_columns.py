import os
import psycopg2
from urllib.parse import urlparse

# Manually parse .env.local to avoid null character issues
with open('.env.local', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        line = line.replace('\x00', '').strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key] = value

local_url = os.getenv('DATABASE_URL')
parsed = urlparse(local_url)
clean_local = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
conn = psycopg2.connect(clean_local)
cur = conn.cursor()

cur.execute('''
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='consolidated_bank_accounts' 
    ORDER BY ordinal_position
''')
print('Columns in consolidated_bank_accounts:')
for row in cur.fetchall():
    print(f'  - {row[0]}')

conn.close()
