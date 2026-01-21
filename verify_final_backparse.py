"""Verify final backparse results after cleanup"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values

env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean)
cur = conn.cursor()

print("\n" + "="*80)
print("FINAL BACKPARSE VERIFICATION")
print("="*80 + "\n")

# 1. Check total records
print("1. Consolidated Bank Accounts:")
cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
total = cur.fetchone()[0]
print(f"   Total records: {total:,}")

# 2. Payment ID statistics
print("\n2. Payment ID Statistics:")
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(payment_id) as with_payment_id,
        COUNT(CASE WHEN payment_id LIKE 'NP_%_NJ_%_PRL%' THEN 1 END) as salary_format,
        COUNT(DISTINCT payment_id) as unique_payment_ids
    FROM consolidated_bank_accounts
""")
stats = cur.fetchone()
print(f"   Total records: {stats[0]:,}")
print(f"   With payment_id: {stats[1]:,} ({stats[1]/stats[0]*100:.1f}%)")
print(f"   Salary format (NP_xxx_NJ_xxx_PRLxxx): {stats[2]:,}")
print(f"   Unique payment IDs: {stats[3]:,}")

# 3. Sample salary payment IDs
if stats[2] > 0:
    print(f"\n3. Sample Salary Payment IDs Extracted:")
    cur.execute("""
        SELECT payment_id, counteragent_uuid, financial_code_uuid
        FROM consolidated_bank_accounts
        WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f"   ✅ {row[0]}")
        print(f"      Counteragent: {row[1] or 'NULL'}")
        print(f"      Financial Code: {row[2] or 'NULL'}")
else:
    print("\n3. ⚠️ No salary payment IDs found")

# 4. Phase statistics
print("\n4. Processing Phase Statistics:")
cur.execute("""
    SELECT 
        SUM(CASE WHEN counteragent_uuid IS NOT NULL THEN 1 ELSE 0 END) as with_counteragent,
        SUM(CASE WHEN project_uuid IS NOT NULL THEN 1 ELSE 0 END) as with_project,
        SUM(CASE WHEN financial_code_uuid IS NOT NULL THEN 1 ELSE 0 END) as with_financial_code
    FROM consolidated_bank_accounts
""")
phase_stats = cur.fetchone()
print(f"   With counteragent: {phase_stats[0]:,} ({phase_stats[0]/total*100:.1f}%)")
print(f"   With project: {phase_stats[1]:,} ({phase_stats[1]/total*100:.1f}%)")
print(f"   With financial_code: {phase_stats[2]:,} ({phase_stats[2]/total*100:.1f}%)")

# 5. Check for any matches with salary_accruals
print("\n5. Matching with salary_accruals:")
cur.execute("""
    SELECT COUNT(*)
    FROM consolidated_bank_accounts c
    INNER JOIN salary_accruals s ON c.payment_id = s.payment_id
""")
matches = cur.fetchone()[0]
print(f"   Exact matches: {matches}")

if matches > 0:
    print("\n   ✅ SUCCESS! Sample matches:")
    cur.execute("""
        SELECT c.payment_id, s.counteragent, c.nominal_amount
        FROM consolidated_bank_accounts c
        INNER JOIN salary_accruals s ON c.payment_id = s.payment_id
        INNER JOIN counteragents ct ON s.counteragent_uuid = ct.counteragent_uuid
        LIMIT 5
    """)
    for row in cur.fetchall():
        print(f"      {row[0]} → {row[1]} ({row[2]})")
else:
    print("   Expected: Different batches/time periods")

conn.close()

print("\n" + "="*80)
print("✅ VERIFICATION COMPLETE")
print("="*80 + "\n")
