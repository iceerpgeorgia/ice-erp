import psycopg2

conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
conn = psycopg2.connect(conn_str)
cur = conn.cursor()

account_uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e'

# Check raw data
cur.execute("""
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE is_processed = TRUE) as processed,
           COUNT(*) FILTER (WHERE is_processed = FALSE) as unprocessed
    FROM bog_gel_raw_893486000
""")
raw_total, raw_processed, raw_unprocessed = cur.fetchone()

# Check consolidated data
cur.execute("""
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE applied_rule_id IS NOT NULL) as with_rule,
           COUNT(*) FILTER (WHERE applied_rule_id IS NULL) as without_rule
    FROM consolidated_bank_accounts
    WHERE bank_account_uuid = %s
""", (account_uuid,))
cons_total, cons_with_rule, cons_without_rule = cur.fetchone()

print('\n📊 Data Summary for GE78BG0000000893486000 (GEL):\n')
print(f"Raw Table (bog_gel_raw_893486000):")
print(f"  Total records:       {raw_total:,}")
print(f"  Processed:           {raw_processed:,}")
print(f"  Unprocessed:         {raw_unprocessed:,}")
print()
print(f"Consolidated Table (consolidated_bank_accounts):")
print(f"  Total records:       {cons_total:,}")
print(f"  With rule applied:   {cons_with_rule:,}")
print(f"  Without rule:        {cons_without_rule:,}")
print()

if cons_without_rule == cons_total:
    print("⚠️  NO RULES APPLIED TO ANY RECORDS - Need to backparse!")
elif cons_with_rule == 0:
    print("⚠️  No rules applied - Need to backparse!")
else:
    print(f"✅ {cons_with_rule} records have rules applied ({cons_with_rule*100//cons_total}%)")

cur.close()
conn.close()
