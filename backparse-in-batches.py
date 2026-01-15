"""
Process Supabase raw data in small batches to avoid timeouts
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse
import sys

BATCH_SIZE = 5000  # Process 5000 records at a time

def get_supabase_connection():
    """Get Supabase connection"""
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('REMOTE_DATABASE_URL='):
                    remote_db_url = line.split('=', 1)[1].strip('"').strip("'")
                    break
    except Exception as e:
        print(f"❌ Error reading .env.local: {e}")
        sys.exit(1)

    parsed_remote = urlparse(remote_db_url)
    clean_remote_url = f"{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}"
    
    conn = psycopg2.connect(clean_remote_url)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    return conn

def main():
    print("=" * 80)
    print("🚀 BATCH BACKPARSE - Processing Supabase data in small batches")
    print("=" * 80)
    print()
    
    conn = get_supabase_connection()
    cursor = conn.cursor()
    
    # Count total records
    print("📊 Counting total records...")
    cursor.execute("""
        SELECT COUNT(*) 
        FROM bog_gel_raw_893486000 
        WHERE DocValueDate IS NOT NULL
    """)
    total_records = cursor.fetchone()[0]
    print(f"✅ Found {total_records} records to process")
    print()
    
    # Get account info
    cursor.execute("""
        SELECT ba.uuid, ba.account_number, c.code, ba.currency_uuid
        FROM bank_accounts ba
        JOIN currencies c ON ba.currency_uuid = c.uuid
        WHERE ba.account_number = 'GE78BG0000000893486000'
    """)
    account_row = cursor.fetchone()
    if not account_row:
        print("❌ Account not found!")
        sys.exit(1)
    
    account_uuid, account_number, currency_code, currency_uuid = account_row
    print(f"📋 Account: {account_number} ({currency_code})")
    print(f"📋 Account UUID: {account_uuid}")
    print()
    
    # Process in batches
    offset = 0
    batch_num = 1
    total_batches = (total_records + BATCH_SIZE - 1) // BATCH_SIZE
    
    while offset < total_records:
        print(f"📦 Processing batch {batch_num}/{total_batches} (offset {offset}, size {BATCH_SIZE})...")
        
        # Call Python script for this batch with offset/limit
        import subprocess
        cmd = [
            'python',
            'import_bank_xml_data.py',
            'backparse',
            '--account-uuid', account_uuid,
            '--offset', str(offset),
            '--limit', str(BATCH_SIZE)
        ]
        
        result = subprocess.run(cmd, env={'VERCEL': '1'}, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ Batch {batch_num} failed!")
            print(result.stderr)
            break
        
        print(f"✅ Batch {batch_num} completed")
        
        offset += BATCH_SIZE
        batch_num += 1
    
    print()
    print("=" * 80)
    print("✅ All batches completed!")
    print("=" * 80)
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
