"""
Quick diagnostic script to check Supabase connection and table indexes
"""
import psycopg2
import time
from urllib.parse import urlparse

# Read database URL
remote_db_url = None
try:
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('REMOTE_DATABASE_URL='):
                remote_db_url = line.split('=', 1)[1].strip().strip('"')
                break
except Exception as e:
    print(f"❌ Error reading .env.local: {e}")
    exit(1)

if not remote_db_url:
    print("❌ REMOTE_DATABASE_URL not found")
    exit(1)

# Connect to Supabase
parsed = urlparse(remote_db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase...")
conn = psycopg2.connect(clean_url, connect_timeout=10)
cursor = conn.cursor()

# Disable statement timeout
cursor.execute("SET statement_timeout = 0")
print("✅ Connected (statement timeout disabled)!\n")

# Check raw table name
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE 'bog_gel_raw_%' 
    ORDER BY table_name DESC 
    LIMIT 1
""")
result = cursor.fetchone()
if not result:
    print("❌ No BOG GEL raw table found")
    exit(1)

raw_table = result[0]
print(f"📊 Raw Table: {raw_table}\n")

# Check row count
print("🔍 Checking row count...")
start = time.time()
cursor.execute(f"SELECT COUNT(*) FROM {raw_table}")
count = cursor.fetchone()[0]
print(f"  ✅ Total rows: {count:,} (query took {time.time()-start:.2f}s)\n")

# Check indexes on uuid column
print("🔍 Checking indexes on uuid column...")
cursor.execute(f"""
    SELECT 
        indexname, 
        indexdef 
    FROM pg_indexes 
    WHERE tablename = '{raw_table}' 
    AND indexdef LIKE '%uuid%'
""")
indexes = cursor.fetchall()
if indexes:
    for idx_name, idx_def in indexes:
        print(f"  ✅ {idx_name}")
        print(f"     {idx_def}")
else:
    print(f"  ⚠️  No index found on uuid column - this will slow down bulk updates!")
print()

# Test single UPDATE performance
print("🔍 Testing single UPDATE performance...")
cursor.execute(f"SELECT uuid FROM {raw_table} LIMIT 1")
test_uuid = cursor.fetchone()[0]
start = time.time()
cursor.execute(f"""
    UPDATE {raw_table} 
    SET is_processed = is_processed 
    WHERE uuid = %s
""", (test_uuid,))
conn.rollback()  # Don't commit test change
print(f"  ✅ Single UPDATE took {time.time()-start:.2f}s\n")

# Test temp table join performance (small sample)
print("🔍 Testing bulk UPDATE JOIN performance (100 rows)...")
cursor.execute(f"SELECT uuid FROM {raw_table} LIMIT 100")
test_uuids = [row[0] for row in cursor.fetchall()]

start = time.time()
cursor.execute("CREATE TEMP TABLE test_updates (uuid UUID)")
cursor.execute("INSERT INTO test_updates (uuid) VALUES " + ",".join([f"('{u}')" for u in test_uuids]))
cursor.execute(f"""
    UPDATE {raw_table} AS raw 
    SET is_processed = TRUE 
    FROM test_updates AS tmp 
    WHERE raw.uuid = tmp.uuid
""")
conn.rollback()  # Don't commit test change
print(f"  ✅ 100-row bulk UPDATE took {time.time()-start:.2f}s\n")

# Estimate time for 48,479 records
print("📊 Estimated bulk UPDATE time for 48,479 records:")
estimated = (time.time()-start) * (48479 / 100)
print(f"  ⏱️  ~{estimated:.0f}s ({estimated/60:.1f} minutes)\n")

cursor.close()
conn.close()

print("✅ Diagnostic complete")
