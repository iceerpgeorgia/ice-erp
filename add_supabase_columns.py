import psycopg2

print("🔧 Adding correction_date and exchange_rate columns to Supabase...")

conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

# Add correction_date column
try:
    cur.execute("ALTER TABLE consolidated_bank_accounts ADD COLUMN correction_date DATE")
    print("✅ Added correction_date column")
except Exception as e:
    if "already exists" in str(e):
        print("⚠️  correction_date column already exists")
    else:
        print(f"❌ Error adding correction_date: {e}")
    conn.rollback()

# Add exchange_rate column
try:
    cur.execute("ALTER TABLE consolidated_bank_accounts ADD COLUMN exchange_rate DECIMAL(20, 10)")
    print("✅ Added exchange_rate column")
except Exception as e:
    if "already exists" in str(e):
        print("⚠️  exchange_rate column already exists")
    else:
        print(f"❌ Error adding exchange_rate: {e}")
    conn.rollback()

conn.commit()
print("\n✅ Schema migration complete!")

# Verify columns exist
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consolidated_bank_accounts' 
    AND column_name IN ('correction_date', 'exchange_rate')
    ORDER BY column_name
""")
print("\n📋 Verified columns:")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

conn.close()
