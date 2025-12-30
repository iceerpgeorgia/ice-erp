import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("Applying banks table migration to Supabase...")

with open('prisma/migrations/20251226000001_add_banks_table/migration.sql', 'r') as f:
    migration_sql = f.read()

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute(migration_sql)
    conn.commit()
    
    print("✅ Migration applied successfully!")
    
    # Verify table was created
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'banks'")
    result = cur.fetchone()
    print(f"✅ banks table exists: {result[0] == 1}")
    
    # Verify bank_uuid column added to bank_accounts
    cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'bank_accounts' AND column_name = 'bank_uuid'")
    result = cur.fetchone()
    print(f"✅ bank_uuid column added to bank_accounts: {result[0] == 1}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
