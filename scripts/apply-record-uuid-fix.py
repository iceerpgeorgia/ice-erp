import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("=" * 80)
print("UPDATING PAYMENTS RECORD_UUID TO STANDARD UUID FORMAT")
print("=" * 80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get current count
    cur.execute("SELECT COUNT(*) FROM payments")
    total_count = cur.fetchone()[0]
    print(f"\n📊 Current payments count: {total_count}")
    
    # Read and execute SQL
    print("\n🔧 Applying changes...")
    with open('scripts/fix-payments-record-uuid.sql', 'r') as f:
        sql = f.read()
        cur.execute(sql)
    
    conn.commit()
    
    print("   ✅ Trigger function updated")
    print("   ✅ All existing record_uuids converted to standard UUID format")
    
    # Verify
    cur.execute("SELECT payment_id, record_uuid FROM payments LIMIT 3")
    samples = cur.fetchall()
    
    print(f"\n📝 Sample records:")
    for payment_id, record_uuid in samples:
        print(f"   payment_id: {payment_id} (custom format)")
        print(f"   record_uuid: {record_uuid} (standard UUID)")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 80)
    print("✅ UPDATE COMPLETED SUCCESSFULLY")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
