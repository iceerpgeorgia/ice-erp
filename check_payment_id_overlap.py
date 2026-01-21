import psycopg2
from urllib.parse import urlparse

# Read database URL
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        if 'REMOTE_DATABASE_URL' in line:
            url = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

parsed = urlparse(url)
conn = psycopg2.connect(f"{parsed.scheme}://{parsed.netloc}{parsed.path}")
cur = conn.cursor()

print("\n" + "="*70)
print("CHECKING PAYMENT ID OVERLAP")
print("="*70)

# Get salary payment IDs from raw table
cur.execute("""
    SELECT DISTINCT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation ~* 'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL[0-9]{6}'
""")
raw_payment_ids = set(row[0].upper() for row in cur.fetchall())
print(f"\n1. Payment IDs in RAW table (salary format): {len(raw_payment_ids):,}")

# Get payment IDs from salary_accruals table
cur.execute("""
    SELECT DISTINCT payment_id
    FROM salary_accruals
    WHERE payment_id IS NOT NULL
""")
salary_payment_ids = set(row[0].upper() for row in cur.fetchall())
print(f"2. Payment IDs in SALARY_ACCRUALS table: {len(salary_payment_ids):,}")

# Find overlap
overlap = raw_payment_ids & salary_payment_ids
print(f"\n3. OVERLAP (exist in both): {len(overlap):,}")

if len(overlap) > 0:
    print("\n   Sample overlapping payment IDs:")
    for pid in list(overlap)[:10]:
        print(f"     - {pid}")
else:
    print("\n   ❌ NO OVERLAP! The payment IDs in raw data don't exist in salary_accruals table!")
    
    # Show samples from each
    print("\n   Sample from RAW table:")
    for pid in list(raw_payment_ids)[:5]:
        print(f"     - {pid}")
    
    print("\n   Sample from SALARY_ACCRUALS table:")
    for pid in list(salary_payment_ids)[:5]:
        print(f"     - {pid}")

cur.close()
conn.close()

print("\n" + "="*70)
