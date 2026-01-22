"""
Simple Supabase connection test to diagnose timeout issues
"""
import psycopg2
import os
from urllib.parse import urlparse
import time
import sys
import io

# Force UTF-8 encoding on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def test_connection():
    """Test basic Supabase connectivity with various queries"""
    
    # Load environment variables
    remote_db_url = None
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('REMOTE_DATABASE_URL=') or line.startswith('DATABASE_URL='):
                    remote_db_url = line.split('=', 1)[1].strip('"').strip("'")
                    print(f"✅ Found database URL: {remote_db_url[:50]}...")
                    break
    except Exception as e:
        print(f"❌ Error reading .env.local: {e}")
        return
    
    # Get Supabase connection string
    remote_db_url = os.getenv('REMOTE_DATABASE_URL') or os.getenv('DATABASE_URL')
    if not remote_db_url:
        print("❌ No REMOTE_DATABASE_URL or DATABASE_URL found")
        return
    
    # CRITICAL FIX: Replace pooler port (6543) with direct port (5432) for long queries
    # Pooler has strict timeouts unsuitable for bulk operations
    if ':6543/' in remote_db_url:
        print("⚠️  Detected pooler connection (port 6543), switching to direct connection (5432)...")
        remote_db_url = remote_db_url.replace(':6543/', ':5432/')
        remote_db_url = remote_db_url.replace('pgbouncer=true', 'pgbouncer=false')
        remote_db_url = remote_db_url.replace('?&', '?')
        print(f"✅ Using direct connection")
    else:
        print("ℹ️  Already using direct connection")
    
    parsed = urlparse(remote_db_url)
    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    
    print(f"🔗 Connecting to: {parsed.netloc}")
    
    try:
        # Test 1: Basic connection with aggressive timeout
        print("\n📡 TEST 1: Basic connection...")
        start = time.time()
        conn = psycopg2.connect(
            clean_url,
            connect_timeout=10,
            keepalives=1,
            keepalives_idle=5,
            keepalives_interval=2,
            keepalives_count=3
        )
        conn.set_session(autocommit=True)
        print(f"  ✅ Connected in {time.time()-start:.2f}s")
        
        cursor = conn.cursor()
        
        # Test 2: Simple SELECT 1
        print("\n📡 TEST 2: SELECT 1...")
        start = time.time()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print(f"  ✅ Result: {result[0]} ({time.time()-start:.2f}s)")
        
        # Test 3: Check statement timeout setting
        print("\n📡 TEST 3: Check current statement_timeout...")
        start = time.time()
        cursor.execute("SHOW statement_timeout")
        timeout_val = cursor.fetchone()[0]
        print(f"  ℹ️  Current statement_timeout: {timeout_val} ({time.time()-start:.2f}s)")
        
        # Test 4: Try to set statement timeout
        print("\n📡 TEST 4: Setting statement_timeout to 5 minutes...")
        start = time.time()
        cursor.execute("SET statement_timeout = '300s'")
        print(f"  ✅ Set successfully ({time.time()-start:.2f}s)")
        
        cursor.execute("SHOW statement_timeout")
        timeout_val = cursor.fetchone()[0]
        print(f"  ℹ️  New statement_timeout: {timeout_val}")
        
        # Test 5: List tables (quick query)
        print("\n📡 TEST 5: List tables...")
        start = time.time()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'bog_gel_raw%'
            LIMIT 5
        """)
        tables = cursor.fetchall()
        print(f"  ✅ Found {len(tables)} raw tables ({time.time()-start:.2f}s)")
        for table in tables:
            print(f"     - {table[0]}")
        
        # Test 6: COUNT with timeout (the problematic query)
        if tables:
            table_name = tables[0][0]
            print(f"\n📡 TEST 6: COUNT(*) on {table_name} (with 30s timeout)...")
            start = time.time()
            try:
                cursor.execute(f"SET LOCAL statement_timeout = '30s'")
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"  ✅ Count: {count:,} records ({time.time()-start:.2f}s)")
            except psycopg2.OperationalError as e:
                print(f"  ⚠️  Query timeout after {time.time()-start:.2f}s")
                print(f"     Error: {str(e)[:200]}")
                # Rollback and continue
                conn.rollback()
        
        # Test 7: Sample row (LIMIT 1 - should be instant)
        if tables:
            table_name = tables[0][0]
            print(f"\n📡 TEST 7: SELECT * FROM {table_name} LIMIT 1...")
            start = time.time()
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
            row = cursor.fetchone()
            print(f"  ✅ Got 1 row ({time.time()-start:.2f}s)")
        
        print("\n" + "="*60)
        print("✅ Connection tests completed")
        print("="*60)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Connection test failed:")
        print(f"   {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_connection()
