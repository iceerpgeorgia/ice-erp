import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("Dropping raw_bank_statements and standardized_transactions tables...")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Drop trigger first
    print("Dropping trigger...")
    cur.execute("DROP TRIGGER IF EXISTS trigger_create_raw_bank_statements_partition ON bank_accounts CASCADE")
    cur.execute("DROP FUNCTION IF EXISTS create_raw_bank_statements_partition() CASCADE")
    conn.commit()
    
    # Drop tables
    print("Dropping tables...")
    cur.execute("DROP TABLE IF EXISTS standardized_transactions CASCADE")
    cur.execute("DROP TABLE IF EXISTS raw_bank_statements CASCADE")
    conn.commit()
    
    print("✅ Tables dropped successfully!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
