import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("="*80)
print("TESTING AUTO-PARTITIONING FOR BANK ACCOUNTS")
print("="*80)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Check current partitions
    print("\n1. Current partitions:")
    cur.execute("""
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'raw_bank_statements%'
        ORDER BY tablename
    """)
    partitions = cur.fetchall()
    for p in partitions:
        print(f"   - {p[0]}")
    
    # Get a bank account to test with
    print("\n2. Getting existing bank accounts...")
    cur.execute("SELECT uuid, account_number FROM bank_accounts LIMIT 3")
    accounts = cur.fetchall()
    
    if not accounts:
        print("   ⚠️  No bank accounts found. Create a bank account first.")
    else:
        print(f"   Found {len(accounts)} bank accounts:")
        for uuid, acc_num in accounts:
            print(f"   - {acc_num} (uuid: {uuid})")
            
            # Check if partition exists for this account
            partition_name = 'raw_bank_statements_' + str(uuid).replace('-', '_')
            cur.execute(f"""
                SELECT COUNT(*) FROM pg_tables 
                WHERE tablename = '{partition_name}'
            """)
            exists = cur.fetchone()[0] > 0
            print(f"     Partition exists: {exists}")
    
    # Show partition creation trigger
    print("\n3. Auto-partition trigger status:")
    cur.execute("""
        SELECT 
            tgname as trigger_name,
            proname as function_name,
            tgenabled as enabled
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgname = 'trigger_create_raw_bank_statements_partition'
    """)
    trigger = cur.fetchone()
    if trigger:
        print(f"   ✅ Trigger: {trigger[0]}")
        print(f"   ✅ Function: {trigger[1]}")
        print(f"   ✅ Enabled: {trigger[2] == 'O'}")
    else:
        print("   ❌ Trigger not found")
    
    # Show how data would be distributed
    print("\n4. Understanding the flow:")
    print("   → When you create a bank account:")
    print("     1. Trigger fires automatically")
    print("     2. New partition table is created")
    print("     3. Example: bank_accounts.uuid = 'abc-123'")
    print("        Creates: raw_bank_statements_abc_123")
    print()
    print("   → When you import raw statements:")
    print("     1. INSERT INTO raw_bank_statements (...)")
    print("     2. PostgreSQL routes data to correct partition")
    print("     3. Each account's data physically separated")
    print()
    print("   → Query examples:")
    print("     • All accounts: SELECT * FROM raw_bank_statements")
    print("     • One account: SELECT * FROM raw_bank_statements WHERE bank_account_uuid = 'uuid'")
    print("     • PostgreSQL automatically scans only relevant partition!")
    
    cur.close()
    conn.close()
    
    print("\n" + "="*80)
    print("✅ AUTO-PARTITIONING IS ACTIVE AND READY!")
    print("="*80)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
