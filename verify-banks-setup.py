import psycopg2

DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Check if banks table exists
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'banks'")
    banks_exists = cur.fetchone()[0] == 1
    print(f"banks table exists: {banks_exists}")
    
    # Check if bank_uuid column exists in bank_accounts
    cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'bank_accounts' AND column_name = 'bank_uuid'")
    bank_uuid_exists = cur.fetchone()[0] == 1
    print(f"bank_uuid column in bank_accounts: {bank_uuid_exists}")
    
    # Add bank_uuid column if it doesn't exist
    if not bank_uuid_exists:
        print("\nAdding bank_uuid column to bank_accounts...")
        cur.execute('ALTER TABLE "bank_accounts" ADD COLUMN "bank_uuid" UUID')
        cur.execute('CREATE INDEX "bank_accounts_bank_uuid_idx" ON "bank_accounts"("bank_uuid")')
        cur.execute('ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_uuid_fkey" FOREIGN KEY ("bank_uuid") REFERENCES "banks"("uuid") ON DELETE SET NULL ON UPDATE CASCADE')
        conn.commit()
        print("✅ bank_uuid column added successfully!")
    else:
        print("✅ bank_uuid column already exists")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
