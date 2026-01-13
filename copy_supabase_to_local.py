#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Copy latest 1000 records from Supabase to LOCAL for testing
"""
import psycopg2
from dotenv import dotenv_values
from datetime import datetime

# Load environment
env = dotenv_values('.env.local')
local_url = env['DATABASE_URL'].split('?')[0]
# Remove query parameters from Supabase URL
remote_url = env['REMOTE_DATABASE_URL'].split('?')[0]

print("📥 Copying ALL records from Supabase to LOCAL...\n")

# Connect to both databases
remote_conn = psycopg2.connect(remote_url)
local_conn = psycopg2.connect(local_url)

remote_cur = remote_conn.cursor()
local_cur = local_conn.cursor()

# Find tables in Supabase
print("🔍 Finding BOG GEL raw tables in Supabase...")
remote_cur.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname='public' AND tablename LIKE 'bog_gel_raw%'
    ORDER BY tablename DESC
    LIMIT 1
""")
remote_table = remote_cur.fetchone()

if not remote_table:
    print("❌ No BOG GEL raw tables found in Supabase")
    exit(1)

remote_table_name = remote_table[0]
print(f"   Found: {remote_table_name}")

# Check record count
remote_cur.execute(f"SELECT COUNT(*) FROM {remote_table_name}")
total_remote = remote_cur.fetchone()[0]
print(f"   Total records in Supabase: {total_remote}")

if total_remote == 0:
    print("❌ No records in Supabase table")
    exit(1)

# Find corresponding local table
local_cur.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname='public' AND tablename LIKE 'bog_gel_raw%'
    ORDER BY tablename DESC
    LIMIT 1
""")
local_table = local_cur.fetchone()

if not local_table:
    print("❌ No BOG GEL raw tables found in LOCAL")
    print("💡 Create the table schema first")
    exit(1)

local_table_name = local_table[0]
print(f"   Local table: {local_table_name}")

# Get column names from BOTH tables and find common columns
remote_cur.execute(f"""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '{remote_table_name}'
    ORDER BY ordinal_position
""")
remote_columns = [col[0] for col in remote_cur.fetchall()]

local_cur.execute(f"""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '{local_table_name}'
    ORDER BY ordinal_position
""")
local_columns = [col[0] for col in local_cur.fetchall()]

# Find common columns
common_columns = [col for col in remote_columns if col in local_columns]

print(f"   Remote columns: {len(remote_columns)}")
print(f"   Local columns: {len(local_columns)}")
print(f"   Common columns: {len(common_columns)}")

# Fetch ALL records from Supabase (only common columns)
print(f"\n📤 Fetching ALL records from Supabase...")
columns_str = ', '.join(common_columns)
remote_cur.execute(f"""
    SELECT {columns_str}
    FROM {remote_table_name}
    ORDER BY created_at DESC
""")
records = remote_cur.fetchall()
print(f"   Fetched: {len(records)} records")

if not records:
    print("❌ No records fetched")
    exit(1)

# Clear local table
print(f"\n🗑️  Clearing local table {local_table_name}...")
local_cur.execute(f"TRUNCATE TABLE {local_table_name} CASCADE")
local_conn.commit()

# Insert into local table
print(f"📥 Inserting {len(records)} records into LOCAL...")
placeholders = ', '.join(['%s'] * len(common_columns))
insert_sql = f"INSERT INTO {local_table_name} ({columns_str}) VALUES ({placeholders})"

local_cur.executemany(insert_sql, records)
local_conn.commit()

# Verify
local_cur.execute(f"SELECT COUNT(*) FROM {local_table_name}")
local_count = local_cur.fetchone()[0]
print(f"✅ Successfully copied {local_count} records to LOCAL")

# Show batch info if column exists
if 'batch_id' in common_columns:
    local_cur.execute(f"""
        SELECT DISTINCT batch_id, COUNT(*) 
        FROM {local_table_name} 
        GROUP BY batch_id
        ORDER BY batch_id DESC
        LIMIT 5
    """)
    batches = local_cur.fetchall()
    if batches:
        print(f"\n📊 Records by batch (latest 5):")
        for batch, count in batches:
            print(f"   - Batch {batch}: {count} records")

# Close connections
remote_cur.close()
remote_conn.close()
local_cur.close()
local_conn.close()

print(f"\n✅ Ready for backparse testing!")
