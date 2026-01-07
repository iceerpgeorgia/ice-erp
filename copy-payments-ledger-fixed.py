#!/usr/bin/env python3
"""
Copy payments_ledger data from Supabase, skipping invalid foreign keys.
"""

import psycopg2
from psycopg2.extras import execute_values

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

def copy_payments_ledger():
    print("🚀 Copying payments_ledger with valid foreign keys only...\n")
    
    source_conn = psycopg2.connect(SUPABASE_URL)
    dest_conn = psycopg2.connect(LOCAL_URL)
    
    source_cursor = source_conn.cursor()
    dest_cursor = dest_conn.cursor()
    
    try:
        # Get all payment_ids that exist in local payments table
        print("📋 Getting valid payment_ids from local database...")
        dest_cursor.execute('SELECT payment_id FROM payments')
        valid_payment_ids = set(row[0] for row in dest_cursor.fetchall())
        print(f"  ✅ Found {len(valid_payment_ids)} valid payment_ids")
        
        # Get all payments_ledger data from Supabase
        print("\n📥 Fetching payments_ledger from Supabase...")
        source_cursor.execute('SELECT * FROM payments_ledger')
        rows = source_cursor.fetchall()
        column_names = [desc[0] for desc in source_cursor.description]
        print(f"  ✅ Found {len(rows)} total rows in Supabase")
        
        # Find payment_id column index
        payment_id_index = column_names.index('payment_id')
        
        # Filter rows with valid payment_ids
        valid_rows = [row for row in rows if row[payment_id_index] in valid_payment_ids]
        invalid_count = len(rows) - len(valid_rows)
        
        print(f"\n📊 Statistics:")
        print(f"  ✅ Valid rows: {len(valid_rows)}")
        print(f"  ⚠️  Invalid rows (skipped): {invalid_count}")
        
        if not valid_rows:
            print("\n❌ No valid rows to copy!")
            return
        
        # Truncate and insert
        print(f"\n🗑️  Truncating local payments_ledger...")
        dest_cursor.execute('TRUNCATE TABLE payments_ledger CASCADE')
        
        print(f"📥 Inserting {len(valid_rows)} valid rows...")
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        insert_query = f'INSERT INTO payments_ledger ({columns_str}) VALUES %s'
        execute_values(dest_cursor, insert_query, valid_rows, page_size=1000)
        
        dest_conn.commit()
        print(f"\n✨ Successfully copied {len(valid_rows)} rows to payments_ledger!")
        
    except Exception as e:
        dest_conn.rollback()
        print(f"\n❌ Error: {str(e)}")
        raise
    finally:
        source_cursor.close()
        dest_cursor.close()
        source_conn.close()
        dest_conn.close()

if __name__ == '__main__':
    copy_payments_ledger()
