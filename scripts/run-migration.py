import psycopg2

# Database connection
conn = psycopg2.connect(
    host="aws-1-eu-west-1.pooler.supabase.com",
    port=5432,
    database="postgres",
    user="postgres.fojbzghphznbslqwurrm",
    password="fulebimojviT1985%"
)

cursor = conn.cursor()

print("🔄 Running migration: create_bank_transaction_batches.sql\n")

with open('prisma/migrations/create_bank_transaction_batches.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

try:
    cursor.execute(sql)
    conn.commit()
    print("✅ Migration completed successfully!")
    print("\n📊 Created:")
    print("   - Table: bank_transaction_batches")
    print("   - Indexes: 5 indexes for performance")
    print("   - Function: validate_batch_total()")
    print("   - View: bank_transaction_batch_summary")
    print("   - Trigger: auto-update updated_at")
except Exception as e:
    conn.rollback()
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    cursor.close()
    conn.close()
