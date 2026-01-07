#!/usr/bin/env python3
"""
Truncate and copy payments and payments_ledger from Supabase to local
"""
import psycopg2
from psycopg2.extras import execute_values

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

print("=" * 80)
print("SYNC PAYMENTS AND PAYMENTS_LEDGER FROM SUPABASE TO LOCAL")
print("=" * 80)

source_conn = psycopg2.connect(SUPABASE_URL)
dest_conn = psycopg2.connect(LOCAL_URL)

source_cursor = source_conn.cursor()
dest_cursor = dest_conn.cursor()

try:
    # Disable foreign key checks temporarily
    print("\n🔓 Disabling foreign key checks...")
    dest_cursor.execute('SET session_replication_role = replica;')
    print("  ✅ Disabled")
    
    # ========== STEP 1: Copy payments table ==========
    print("\n" + "=" * 80)
    print("STEP 1: PAYMENTS TABLE")
    print("=" * 80)
    
    print("\n📥 Fetching payments from Supabase...")
    source_cursor.execute('SELECT * FROM payments')
    payments_rows = source_cursor.fetchall()
    payments_columns = [desc[0] for desc in source_cursor.description]
    print(f"  ✅ Found {len(payments_rows)} rows in Supabase")
    
    print(f"\n🗑️  Truncating local payments table...")
    dest_cursor.execute('TRUNCATE TABLE payments CASCADE')
    print(f"  ✅ Truncated")
    
    print(f"\n📥 Inserting {len(payments_rows)} rows into local payments...")
    columns_str = ', '.join([f'"{col}"' for col in payments_columns])
    insert_query = f'INSERT INTO payments ({columns_str}) VALUES %s'
    execute_values(dest_cursor, insert_query, payments_rows, page_size=1000)
    dest_conn.commit()
    print(f"  ✅ Inserted {len(payments_rows)} rows")
    
    # ========== STEP 2: Copy payments_ledger table ==========
    print("\n" + "=" * 80)
    print("STEP 2: PAYMENTS_LEDGER TABLE")
    print("=" * 80)
    
    print("\n📥 Fetching payments_ledger from Supabase...")
    source_cursor.execute('SELECT * FROM payments_ledger')
    ledger_rows = source_cursor.fetchall()
    ledger_columns = [desc[0] for desc in source_cursor.description]
    print(f"  ✅ Found {len(ledger_rows)} rows in Supabase")
    
    print(f"\n🗑️  Truncating local payments_ledger table...")
    dest_cursor.execute('TRUNCATE TABLE payments_ledger CASCADE')
    print(f"  ✅ Truncated")
    
    print(f"\n📥 Inserting {len(ledger_rows)} rows into local payments_ledger...")
    columns_str = ', '.join([f'"{col}"' for col in ledger_columns])
    insert_query = f'INSERT INTO payments_ledger ({columns_str}) VALUES %s'
    execute_values(dest_cursor, insert_query, ledger_rows, page_size=1000)
    dest_conn.commit()
    print(f"  ✅ Inserted {len(ledger_rows)} rows")
    
    # ========== STEP 3: Verify the sync ==========
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)
    
    # Test the JOIN
    query = """
    SELECT 
        pl.payment_id,
        p.project_uuid IS NOT NULL as has_project,
        p.counteragent_uuid IS NOT NULL as has_counteragent
    FROM payments_ledger pl
    LEFT JOIN payments p ON pl.payment_id = p.payment_id
    ORDER BY pl.effective_date DESC
    LIMIT 20
    """
    
    dest_cursor.execute(query)
    test_rows = dest_cursor.fetchall()
    
    matched = sum(1 for row in test_rows if row[1])
    print(f"\nTesting most recent 20 ledger entries:")
    print(f"  ✅ {matched}/20 have matching payments with relationships")
    
    # Re-enable foreign key checks
    print("\n🔒 Re-enabling foreign key checks...")
    dest_cursor.execute('SET session_replication_role = DEFAULT;')
    print("  ✅ Re-enabled")
    
    if matched > 0:
        print("\n✨ SUCCESS! Data synced correctly from Supabase to local.")
    else:
        print("\n⚠️  WARNING: No matches found. Please verify the data.")
    
except Exception as e:
    dest_conn.rollback()
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    raise
finally:
    source_cursor.close()
    dest_cursor.close()
    source_conn.close()
    dest_conn.close()

print("\n" + "=" * 80)
