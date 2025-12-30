import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("Recreating raw_bank_statements with partitioning and adding standardized_transactions...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Drop existing table
    print("Dropping existing raw_bank_statements table...")
    cur.execute("DROP TABLE IF EXISTS raw_bank_statements CASCADE")
    conn.commit()
    print("✅ Existing table dropped")
    
    # Apply new migration
    print("\nApplying new migration...")
    with open('prisma/migrations/20251227000000_add_raw_bank_statements/migration.sql', 'r') as f:
        migration_sql = f.read()
    
    cur.execute(migration_sql)
    conn.commit()
    
    print("✅ Migration applied successfully!")
    
    # Verify tables were created
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'raw_bank_statements'")
    result = cur.fetchone()
    print(f"✅ raw_bank_statements table exists: {result[0] == 1}")
    
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'standardized_transactions'")
    result = cur.fetchone()
    print(f"✅ standardized_transactions table exists: {result[0] == 1}")
    
    # Check partitions
    cur.execute("""
        SELECT count(*) FROM pg_inherits 
        WHERE inhparent = 'raw_bank_statements'::regclass
    """)
    partition_count = cur.fetchone()[0]
    print(f"✅ Partitions created: {partition_count} (including default partition)")
    
    # Verify trigger
    cur.execute("""
        SELECT count(*) FROM pg_trigger 
        WHERE tgname = 'trigger_create_raw_bank_statements_partition'
    """)
    trigger_exists = cur.fetchone()[0] > 0
    print(f"✅ Auto-partition trigger exists: {trigger_exists}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
