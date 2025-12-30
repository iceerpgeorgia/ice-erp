import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("Applying bank_accounts table migration to Supabase...")

with open('prisma/migrations/20251226000000_add_bank_accounts_table/migration.sql', 'r') as f:
    migration_sql = f.read()

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute(migration_sql)
    conn.commit()
    
    print("✅ Migration applied successfully!")
    
    # Verify table was created
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'bank_accounts'")
    result = cur.fetchone()
    print(f"✅ bank_accounts table exists: {result[0] == 1}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
