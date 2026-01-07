#!/usr/bin/env python3
"""
Restore payment ID 1 from local to Supabase
"""
import psycopg2

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

print("=" * 80)
print("RESTORE PAYMENT ID 1 TO SUPABASE")
print("=" * 80)

local_conn = psycopg2.connect(LOCAL_URL)
supabase_conn = psycopg2.connect(SUPABASE_URL)

local_cur = local_conn.cursor()
supabase_cur = supabase_conn.cursor()

try:
    # Fetch from local
    print("\n📥 Fetching payment ID 1 from local database...")
    local_cur.execute('SELECT * FROM payments WHERE id = 1')
    payment_row = local_cur.fetchone()
    column_names = [desc[0] for desc in local_cur.description]
    
    if not payment_row:
        print("  ❌ Payment ID 1 not found in local database")
        exit(1)
    
    payment_id_str = payment_row[column_names.index('payment_id')]
    print(f"  ✅ Found: {payment_id_str}")
    
    # Check if it already exists in Supabase
    supabase_cur.execute('SELECT id FROM payments WHERE id = 1')
    existing = supabase_cur.fetchone()
    
    if existing:
        print(f"\n⚠️  Payment ID 1 already exists in Supabase")
        print("     Aborting restore")
        exit(0)
    
    # Insert into Supabase
    print(f"\n📤 Inserting payment into Supabase...")
    columns_str = ', '.join([f'"{col}"' for col in column_names])
    placeholders = ', '.join(['%s'] * len(column_names))
    insert_query = f'INSERT INTO payments ({columns_str}) VALUES ({placeholders})'
    supabase_cur.execute(insert_query, payment_row)
    supabase_conn.commit()
    
    print(f"  ✅ Payment restored successfully!")
    print(f"\nRestored payment details:")
    print(f"  ID: 1")
    print(f"  Payment ID: {payment_id_str}")
    print(f"  Project UUID: {payment_row[column_names.index('project_uuid')]}")
    print(f"  Counteragent UUID: {payment_row[column_names.index('counteragent_uuid')]}")
    print(f"  Created At: {payment_row[column_names.index('created_at')]}")
    
    # Verify
    supabase_cur.execute('SELECT COUNT(*) FROM payments')
    count = supabase_cur.fetchone()[0]
    print(f"\n📊 Total payments in Supabase: {count}")
    
except Exception as e:
    supabase_conn.rollback()
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    raise
finally:
    local_cur.close()
    supabase_cur.close()
    local_conn.close()
    supabase_conn.close()

print("\n" + "=" * 80)
