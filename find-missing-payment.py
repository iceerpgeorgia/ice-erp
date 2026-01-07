#!/usr/bin/env python3
"""
Compare payments tables between Supabase and Local to find missing record
"""
import psycopg2

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

print("=" * 80)
print("COMPARING PAYMENTS TABLES: LOCAL vs SUPABASE")
print("=" * 80)

supabase_conn = psycopg2.connect(SUPABASE_URL)
local_conn = psycopg2.connect(LOCAL_URL)

supabase_cur = supabase_conn.cursor()
local_cur = local_conn.cursor()

try:
    # Count records
    print("\n📊 Record Counts:")
    
    local_cur.execute('SELECT COUNT(*) FROM payments')
    local_count = local_cur.fetchone()[0]
    print(f"  Local: {local_count}")
    
    supabase_cur.execute('SELECT COUNT(*) FROM payments')
    supabase_count = supabase_cur.fetchone()[0]
    print(f"  Supabase: {supabase_count}")
    
    difference = local_count - supabase_count
    print(f"  Difference: {difference}")
    
    if difference != 0:
        if difference > 0:
            print(f"\n🔍 Local has {difference} more record(s) than Supabase")
        else:
            print(f"\n🔍 Supabase has {abs(difference)} more record(s) than Local")
        
        print("\nFinding missing record(s)...")
        
        # Get all payment_ids from both
        local_cur.execute('SELECT id, payment_id, project_uuid, counteragent_uuid, created_at FROM payments ORDER BY id')
        local_payments = {row[0]: row for row in local_cur.fetchall()}
        
        supabase_cur.execute('SELECT id, payment_id, project_uuid, counteragent_uuid, created_at FROM payments ORDER BY id')
        supabase_payments = {row[0]: row for row in supabase_cur.fetchall()}
        
        # Find records in local but not in Supabase
        local_missing = set(local_payments.keys()) - set(supabase_payments.keys())
        supabase_missing = set(supabase_payments.keys()) - set(local_payments.keys())
        
        if local_missing:
            print(f"\n✅ Found {len(local_missing)} record(s) in LOCAL missing from Supabase:\n")
            for record_id in sorted(local_missing):
                record = local_payments[record_id]
                print(f"  ID: {record[0]}")
                print(f"  Payment ID: {record[1]}")
                print(f"  Project UUID: {record[2]}")
                print(f"  Counteragent UUID: {record[3]}")
                print(f"  Created At: {record[4]}")
                print()
                
                # Get full record for restore
                local_cur.execute('SELECT * FROM payments WHERE id = %s', (record_id,))
                full_record = local_cur.fetchone()
                column_names = [desc[0] for desc in local_cur.description]
                
                print(f"  📝 Full record data:")
                for col, val in zip(column_names, full_record):
                    if val is not None:
                        print(f"     {col}: {val}")
                print()
        
        if supabase_missing:
            print(f"\n✅ Found {len(supabase_missing)} record(s) in SUPABASE missing from Local:\n")
            for record_id in sorted(supabase_missing):
                record = supabase_payments[record_id]
                print(f"  ID: {record[0]}")
                print(f"  Payment ID: {record[1]}")
                print(f"  Project UUID: {record[2]}")
                print(f"  Counteragent UUID: {record[3]}")
                print(f"  Created At: {record[4]}")
                print()
                
                # Get full record
                supabase_cur.execute('SELECT * FROM payments WHERE id = %s', (record_id,))
                full_record = supabase_cur.fetchone()
                column_names = [desc[0] for desc in supabase_cur.description]
                
                print(f"  📝 Full record data:")
                for col, val in zip(column_names, full_record):
                    if val is not None:
                        print(f"     {col}: {val}")
                print()
        
        if not local_missing and not supabase_missing:
            print("\n⚠️  No missing records found by ID comparison")
    else:
        print(f"\n✅ Both databases have the same number of records")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    supabase_cur.close()
    local_cur.close()
    supabase_conn.close()
    local_conn.close()

print("=" * 80)
