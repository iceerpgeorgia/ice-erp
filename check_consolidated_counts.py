import psycopg2
import sys

# Read connection string from .env.local
conn_str = None
try:
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('REMOTE_DATABASE_URL='):
                conn_str = line.split('=', 1)[1].strip('"').strip("'")
                break
except Exception as e:
    print(f"Error reading .env.local: {e}", file=sys.stderr)
    sys.exit(1)

if not conn_str:
    print("ERROR: REMOTE_DATABASE_URL not found in .env.local", file=sys.stderr)
    sys.exit(1)

# Use direct connection (not pooler)
if ':6543/' in conn_str:
    conn_str = conn_str.replace(':6543/', ':5432/')

# Parse to remove query parameters
from urllib.parse import urlparse
parsed = urlparse(conn_str)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print(f"Connecting to: {parsed.netloc}{parsed.path}")

try:
    conn = psycopg2.connect(clean_url, connect_timeout=10)
    cur = conn.cursor()
    
    # Total count
    cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts')
    total = cur.fetchone()[0]
    print(f'Total consolidated records: {total:,}')
    
    # Count by account
    cur.execute('''
        SELECT 
            bank_account_uuid, 
            COUNT(*) as record_count
        FROM consolidated_bank_accounts 
        GROUP BY bank_account_uuid 
        ORDER BY record_count DESC
    ''')
    
    print('\nRecords per account:')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]:,} records')
    
    # Check the specific account we just backparsed
    target_uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e'
    cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts WHERE bank_account_uuid = %s', (target_uuid,))
    target_count = cur.fetchone()[0]
    print(f'\nAccount {target_uuid}: {target_count:,} records')
    
    # Check raw table count
    cur.execute('SELECT COUNT(*) FROM bog_gel_raw_893486000')
    raw_count = cur.fetchone()[0]
    print(f'Raw table bog_gel_raw_893486000: {raw_count:,} records')
    
    conn.close()
    
except Exception as e:
    print(f'Error: {e}')
