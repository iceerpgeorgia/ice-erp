"""Verify backparse results with salary payment IDs"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values

env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean)
cur = conn.cursor()

print("="*80)
print("BACKPARSE RESULTS VERIFICATION")
print("="*80 + "\n")

# 1. Check salary payment ID pattern in consolidated
print("1. Salary payment IDs in consolidated_bank_accounts:")
cur.execute("""
    SELECT COUNT(*)
    FROM consolidated_bank_accounts
    WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
""")
salary_pattern_count = cur.fetchone()[0]
print(f"   Records with salary payment ID pattern: {salary_pattern_count}")

# 2. Get sample matches
print("\n2. Sample salary payment ID matches:")
cur.execute("""
    SELECT c.payment_id, c.counteragent_uuid, c.financial_code_uuid, c.nominal_currency_uuid
    FROM consolidated_bank_accounts c
    WHERE c.payment_id LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 10
""")
samples = cur.fetchall()
if samples:
    for row in samples:
        print(f"   ✅ {row[0]}")
        print(f"      Counteragent: {row[1] or 'NULL'}")
        print(f"      Financial Code: {row[2] or 'NULL'}")
        print(f"      Currency: {row[3] or 'NULL'}")
        print()
else:
    print("   ⚠️ No salary payment IDs found in consolidated!")

# 3. Check if any salary payment IDs matched
print("3. Checking actual matches with salary_accruals:")
cur.execute("""
    SELECT COUNT(*)
    FROM consolidated_bank_accounts c
    INNER JOIN salary_accruals s ON c.payment_id = s.payment_id
""")
actual_matches = cur.fetchone()[0]
print(f"   Actual matches with salary_accruals: {actual_matches}")

# 4. Compare before/after
print("\n4. Payment ID statistics:")
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(payment_id) as with_payment_id,
        COUNT(CASE WHEN payment_id LIKE 'NP_%_NJ_%_PRL%' THEN 1 END) as salary_format
    FROM consolidated_bank_accounts
""")
stats = cur.fetchone()
print(f"   Total records: {stats[0]}")
print(f"   With payment_id: {stats[1]} ({stats[1]/stats[0]*100:.1f}%)")
print(f"   Salary format: {stats[2]} ({stats[2]/stats[0]*100:.1f}%)")

# 5. Check Phase 3 matches (from previous backparse)
print("\n5. Phase 3 payment ID matches:")
print(f"   Previous backparse: 6,876 matches")
print(f"   Current result: {stats[1]} total payment IDs")
print(f"   Salary pattern: {stats[2]} (NEW!)")

conn.close()

print("\n" + "="*80)
print("✅ VERIFICATION COMPLETE")
print("="*80)
