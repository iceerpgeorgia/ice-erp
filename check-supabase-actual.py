import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

# Use REMOTE_DATABASE_URL for actual Supabase
remote_url = os.getenv('REMOTE_DATABASE_URL')
if not remote_url:
    print("❌ REMOTE_DATABASE_URL not found in environment")
    exit(1)
if '?pgbouncer=' in remote_url or '?connection_limit=' in remote_url:
    # Clean up pgbouncer parameters for direct connection
    base_url = remote_url.split('?')[0]
    remote_url = base_url

print(f"Connecting to: {remote_url.split('@')[1] if '@' in remote_url else 'Supabase'}")

try:
    conn = psycopg2.connect(remote_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get all tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    all_tables = [row['table_name'] for row in cur.fetchall()]
    
    print(f"\n=== Found {len(all_tables)} tables ===")
    
    # Find bank-related tables
    bank_patterns = ['bank', 'bog', 'raw', 'statement', 'account']
    bank_tables = [t for t in all_tables if any(pattern in t.lower() for pattern in bank_patterns)]
    
    print("\n=== Bank-related Tables ===")
    for table in bank_tables:
        try:
            cur.execute(f'SELECT COUNT(*) as count FROM "{table}"')
            count = cur.fetchone()['count']
            status = "✅" if count > 0 else "⚠️ "
            print(f"{status} {table}: {count} rows")
        except Exception as e:
            print(f"❌ {table}: ERROR - {str(e)}")
    
    # Check specifically for bog_gel_raw_893486000
    if 'bog_gel_raw_893486000' in all_tables:
        print("\n=== bog_gel_raw_893486000 Details ===")
        cur.execute('SELECT COUNT(*) as count FROM bog_gel_raw_893486000')
        count = cur.fetchone()['count']
        print(f"Total rows: {count}")
        
        if count > 0:
            cur.execute('SELECT * FROM bog_gel_raw_893486000 LIMIT 2')
            rows = cur.fetchall()
            print("\nSample rows:")
            for i, row in enumerate(rows, 1):
                print(f"\n  Row {i}:")
                for key, value in dict(row).items():
                    print(f"    {key}: {value}")
    
    # Check other key tables
    print("\n=== Key Tables Row Counts ===")
    key_tables = ['banks', 'bank_accounts', 'consolidated_bank_accounts']
    for table in key_tables:
        if table in all_tables:
            cur.execute(f'SELECT COUNT(*) as count FROM "{table}"')
            count = cur.fetchone()['count']
            status = "✅" if count > 0 else "⚠️ "
            print(f"{status} {table}: {count} rows")
    
    cur.close()
    conn.close()
    print("\n✅ Check complete!")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
