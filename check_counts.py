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
remote_url = os.getenv('REMOTE_DATABASE_URL')

# Connect to LOCAL for consolidated
parsed = urlparse(local_url)
clean_local = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
local_conn = psycopg2.connect(clean_local)
local_cur = local_conn.cursor()

# Connect to SUPABASE for raw
parsed_remote = urlparse(remote_url)
clean_remote = f'{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}'
remote_conn = psycopg2.connect(clean_remote)
remote_cur = remote_conn.cursor()

# Count consolidated (LOCAL)
local_cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts')
cons_count = local_cur.fetchone()[0]

# Count raw (SUPABASE)
remote_cur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_name LIKE 'bog_gel_raw%' 
    ORDER BY table_name
""")
raw_tables = remote_cur.fetchall()
print(f'Raw tables found on SUPABASE: {[t[0] for t in raw_tables]}')

if raw_tables:
    raw_table = raw_tables[0][0]
    remote_cur.execute(f'SELECT COUNT(*) FROM {raw_table}')
    raw_count = remote_cur.fetchone()[0]
else:
    raw_count = 0
    raw_table = None

print(f'Consolidated table (LOCAL): {cons_count:,}')
print(f'Raw table (SUPABASE): {raw_count:,} (table: {raw_table})')
print(f'Difference: {cons_count - raw_count:,}')

if not raw_table:
    print('\nNo raw table found on Supabase!')
    local_conn.close()
    remote_conn.close()
    exit(1)

# Check for the specific record (SUPABASE)
print(f'\n--- Checking record ID 335 from raw table {raw_table} (SUPABASE) ---')
remote_cur.execute(f'''
    SELECT id, dockey, entriesid, docprodgroup, counteragent_inn, 
           counteragent_processed, parsing_rule_processed, payment_id_processed
    FROM {raw_table}
    WHERE id = 335
''')
row = remote_cur.fetchone()
if row:
    print(f'ID: {row[0]}')
    print(f'DocKey: {row[1]}')
    print(f'EntriesId: {row[2]}')
    print(f'DocProdGroup: {row[3]}')
    print(f'Counteragent INN: {row[4]}')
    print(f'Counteragent Processed: {row[5]}')
    print(f'Parsing Rule Processed: {row[6]}')
    print(f'Payment ID Processed: {row[7]}')
else:
    print('Record not found')

# Check consolidated record (LOCAL)
print('\n--- Checking consolidated record ID 1149437 (LOCAL) ---')
local_cur.execute('''
    SELECT id, raw_record_uuid, counteragent_uuid, project_uuid, financial_code_uuid, 
           account_currency_amount, transaction_date, description, processing_case
    FROM consolidated_bank_accounts 
    WHERE id = 1149437
''')
row = local_cur.fetchone()
if row:
    print(f'ID: {row[0]}')
    print(f'Raw Record UUID: {row[1]}')
    print(f'Counteragent UUID: {row[2]}')
    print(f'Project UUID: {row[3]}')
    print(f'Financial Code UUID: {row[4]}')
    print(f'Amount: {row[5]}')
    print(f'Transaction Date: {row[6]}')
    print(f'Description: {row[7][:100] if row[7] else None}...')
    print(f'Processing Case: {row[8]}')
else:
    print('Record not found')

# Check for duplicates based on raw_record_uuid
print('\n--- Checking for duplicate raw_record_uuid in consolidated ---')
local_cur.execute('''
    SELECT raw_record_uuid, COUNT(*) as cnt
    FROM consolidated_bank_accounts
    GROUP BY raw_record_uuid
    HAVING COUNT(*) > 1
    LIMIT 10
''')
duplicates = local_cur.fetchall()
if duplicates:
    print(f'Found {len(duplicates)} raw_record_uuid with duplicates (showing first 10):')
    for dup in duplicates:
        print(f'  UUID: {dup[0]}, Count: {dup[1]}')
        # Show the IDs
        local_cur.execute(f"SELECT id FROM consolidated_bank_accounts WHERE raw_record_uuid = '{dup[0]}'")
        ids = [r[0] for r in local_cur.fetchall()]
        print(f'    IDs: {ids}')
else:
    print('No raw_record_uuid duplicates found')

local_conn.close()
remote_conn.close()
