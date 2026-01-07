#!/usr/bin/env python3
"""
Restore a specific payment record from Supabase
"""
import psycopg2
import sys

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

payment_id = 1

print("=" * 80)
print(f"RESTORE PAYMENT WITH ID {payment_id} FROM SUPABASE")
print("=" * 80)

source_conn = psycopg2.connect(SUPABASE_URL)
dest_conn = psycopg2.connect(LOCAL_URL)

source_cursor = source_conn.cursor()
dest_cursor = dest_conn.cursor()

try:
    # Fetch from Supabase
    print(f"\n📥 Fetching payment with id={payment_id} from Supabase...")
    source_cursor.execute('SELECT * FROM payments WHERE id = %s', (payment_id,))
    payment_row = source_cursor.fetchone()
    
    if not payment_row:
        print(f"  ❌ Payment with id={payment_id} not found in Supabase")
        sys.exit(1)
    
    column_names = [desc[0] for desc in source_cursor.description]
    print(f"  ✅ Found payment: {payment_row[column_names.index('payment_id')]}")
    
    # Check if it exists locally
    dest_cursor.execute('SELECT id FROM payments WHERE id = %s', (payment_id,))
    existing = dest_cursor.fetchone()
    
    if existing:
        print(f"\n⚠️  Payment with id={payment_id} already exists locally")
        print("     Skipping insert")
    else:
        # Insert into local
        print(f"\n📥 Inserting payment into local database...")
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        placeholders = ', '.join(['%s'] * len(column_names))
        insert_query = f'INSERT INTO payments ({columns_str}) VALUES ({placeholders})'
        dest_cursor.execute(insert_query, payment_row)
        dest_conn.commit()
        print(f"  ✅ Payment restored successfully!")
        
        # Show details
        payment_id_str = payment_row[column_names.index('payment_id')]
        print(f"\nRestored payment details:")
        print(f"  ID: {payment_id}")
        print(f"  Payment ID: {payment_id_str}")
        if 'project_uuid' in column_names:
            print(f"  Project UUID: {payment_row[column_names.index('project_uuid')]}")
        if 'counteragent_uuid' in column_names:
            print(f"  Counteragent UUID: {payment_row[column_names.index('counteragent_uuid')]}")
    
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
