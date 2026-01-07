#!/usr/bin/env python3
"""
Copy payments_ledger disabling foreign key checks temporarily
"""

import psycopg2
from psycopg2.extras import execute_values

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

source_conn = psycopg2.connect(SUPABASE_URL)
dest_conn = psycopg2.connect(LOCAL_URL)

source_cursor = source_conn.cursor()
dest_cursor = dest_conn.cursor()

print("🚀 Copying payments_ledger (disabling FK checks)...\n")

try:
    # Fetch from Supabase
    print("📥 Fetching payments_ledger from Supabase...")
    source_cursor.execute('SELECT * FROM payments_ledger')
    rows = source_cursor.fetchall()
    column_names = [desc[0] for desc in source_cursor.description]
    print(f"  ✅ Found {len(rows)} rows")
    
    # Disable FK checks, truncate, insert
    print(f"\n🔓 Disabling foreign key checks...")
    dest_cursor.execute('SET session_replication_role = replica;')
    
    print(f"🗑️  Truncating local payments_ledger...")
    dest_cursor.execute('TRUNCATE TABLE payments_ledger CASCADE')
    
    print(f"📥 Inserting {len(rows)} rows...")
    columns_str = ', '.join([f'"{col}"' for col in column_names])
    insert_query = f'INSERT INTO payments_ledger ({columns_str}) VALUES %s'
    execute_values(dest_cursor, insert_query, rows, page_size=1000)
    
    print(f"🔒 Re-enabling foreign key checks...")
    dest_cursor.execute('SET session_replication_role = DEFAULT;')
    
    dest_conn.commit()
    print(f"\n✨ Successfully copied {len(rows)} rows!")
    
except Exception as e:
    dest_conn.rollback()
    print(f"\n❌ Error: {str(e)}")
finally:
    source_cursor.close()
    dest_cursor.close()
    source_conn.close()
    dest_conn.close()
