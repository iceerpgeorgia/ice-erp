import os
import psycopg2
from urllib.parse import urlparse

# Manually parse .env.local
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

# Get raw record UUID
cur.execute('SELECT uuid FROM bog_gel_raw_893486000 WHERE id = 288')
raw_uuid = cur.fetchone()[0]
print(f'Raw UUID for ID 288: {raw_uuid}')

# Get consolidated record
cur.execute('''
    SELECT id, counteragent_uuid, project_uuid, financial_code_uuid, processing_case 
    FROM consolidated_bank_accounts 
    WHERE raw_record_uuid = %s
''', (raw_uuid,))
row = cur.fetchone()

if row:
    print(f'\nConsolidated record:')
    print(f'  id: {row[0]}')
    print(f'  counteragent_uuid: {row[1]}')
    print(f'  project_uuid: {row[2]}')
    print(f'  financial_code_uuid: {row[3]}')
    print(f'  processing_case: {row[4]}')
else:
    print('No consolidated record found')

conn.close()
