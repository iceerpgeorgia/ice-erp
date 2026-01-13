"""
Copy raw BOG GEL data from Supabase to Local PostgreSQL
This ensures both raw and consolidated data are in the same database for consistency.
"""
import os
import psycopg2
from urllib.parse import urlparse
import sys

# Manually parse .env.local to avoid null character issues
with open('.env.local', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        line = line.replace('\x00', '').strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key] = value

local_url = os.getenv('DATABASE_URL')
remote_url = os.getenv('REMOTE_DATABASE_URL')

if not local_url or not remote_url:
    print("❌ Missing DATABASE_URL or REMOTE_DATABASE_URL")
    sys.exit(1)

# Connect to both databases
parsed_local = urlparse(local_url)
clean_local = f'{parsed_local.scheme}://{parsed_local.netloc}{parsed_local.path}'
local_conn = psycopg2.connect(clean_local)
local_cur = local_conn.cursor()

parsed_remote = urlparse(remote_url)
clean_remote = f'{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}'
remote_conn = psycopg2.connect(clean_remote)
remote_cur = remote_conn.cursor()

print("🔗 Connected to both databases\n")

# Find raw tables on Supabase
remote_cur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_name LIKE 'bog_gel_raw%' 
    ORDER BY table_name
""")
remote_tables = [r[0] for r in remote_cur.fetchall()]

if not remote_tables:
    print("❌ No raw tables found on Supabase")
    sys.exit(1)

print(f"📊 Found {len(remote_tables)} raw table(s) on Supabase:")
for table in remote_tables:
    print(f"  - {table}")

# Process each table
for remote_table in remote_tables:
    print(f"\n{'='*80}")
    print(f"Processing: {remote_table}")
    print(f"{'='*80}\n")
    
    # Count records on Supabase
    remote_cur.execute(f"SELECT COUNT(*) FROM {remote_table}")
    remote_count = remote_cur.fetchone()[0]
    print(f"📦 Supabase has {remote_count:,} records")
    
    # Check if table exists locally
    local_cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = %s
        )
    """, (remote_table,))
    
    local_exists = local_cur.fetchone()[0]
    
    if local_exists:
        # Count existing local records
        local_cur.execute(f"SELECT COUNT(*) FROM {remote_table}")
        local_count = local_cur.fetchone()[0]
        print(f"📦 Local has {local_count:,} records")
        
        if local_count > 0:
            response = input(f"\n⚠️  Local table {remote_table} has {local_count} records. Truncate? (yes/no): ")
            if response.lower() != 'yes':
                print("⏭️  Skipping this table")
                continue
            
            print(f"🗑️  Truncating local {remote_table}...")
            local_cur.execute(f"TRUNCATE TABLE {remote_table} RESTART IDENTITY CASCADE")
            local_conn.commit()
    else:
        print(f"⚠️  Local table {remote_table} does not exist - will be created")
        
        # Get CREATE TABLE statement from Supabase
        remote_cur.execute(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, (remote_table,))
        columns = remote_cur.fetchall()
        
        create_stmt = f"CREATE TABLE {remote_table} (\n"
        col_defs = []
        for col in columns:
            col_name, data_type, is_nullable, col_default = col
            nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
            default = f"DEFAULT {col_default}" if col_default else ""
            col_defs.append(f"  {col_name} {data_type} {nullable} {default}".strip())
        create_stmt += ",\n".join(col_defs) + "\n)"
        
        print(f"📄 Creating local table {remote_table}...")
        local_cur.execute(create_stmt)
        local_conn.commit()
    
    # Copy data
    print(f"\n📋 Copying {remote_count:,} records from Supabase to Local...")
    
    # Get all column names
    remote_cur.execute(f"""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (remote_table,))
    columns = [r[0] for r in remote_cur.fetchall()]
    columns_str = ", ".join(columns)
    
    # Fetch all data from Supabase
    print("  ⬇️  Fetching from Supabase...")
    remote_cur.execute(f"SELECT {columns_str} FROM {remote_table}")
    
    # Insert to Local in batches
    print("  ⬆️  Inserting to Local...")
    batch_size = 1000
    inserted = 0
    
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = f"INSERT INTO {remote_table} ({columns_str}) VALUES ({placeholders})"
    
    while True:
        rows = remote_cur.fetchmany(batch_size)
        if not rows:
            break
        
        local_cur.executemany(insert_sql, rows)
        local_conn.commit()
        inserted += len(rows)
        print(f"  📊 Inserted {inserted:,}/{remote_count:,} ({inserted*100//remote_count}%)", end='\r')
    
    print(f"\n  ✅ Copied {inserted:,} records successfully")
    
    # Verify
    local_cur.execute(f"SELECT COUNT(*) FROM {remote_table}")
    final_count = local_cur.fetchone()[0]
    print(f"  ✅ Verification: Local now has {final_count:,} records")

print(f"\n{'='*80}")
print("✅ All raw tables copied from Supabase to Local")
print(f"{'='*80}\n")

local_conn.close()
remote_conn.close()
