import psycopg2
import time

# Direct connection URL (port 5432)
url = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

print("Connecting to Supabase (direct port 5432)...")
start = time.time()

try:
    conn = psycopg2.connect(url, connect_timeout=30, keepalives=1)
    print(f"Connected in {time.time()-start:.2f}s")
    
    cursor = conn.cursor()
    
    print("Testing SELECT 1...")
    start = time.time()
    cursor.execute("SELECT 1")
    print(f"Query OK ({time.time()-start:.2f}s)")
    
    print("Disabling statement timeout...")
    cursor.execute("SET statement_timeout = 0")
    print("Timeout disabled")
    
    print("Testing COUNT query...")
    start = time.time()
    cursor.execute("SELECT COUNT(*) FROM bog_gel_raw_gel_600582948_8c5b_4715_b75c_ca03e3d36a4e LIMIT 1")
    count = cursor.fetchone()[0]
    print(f"Count: {count} ({time.time()-start:.2f}s)")
    
    print("SUCCESS - Direct connection works!")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
