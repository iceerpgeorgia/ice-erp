"""Check date format differences"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values

env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
conn = psycopg2.connect(clean)
cur = conn.cursor()

print("\n" + "="*80)
print("COMPARING DATE FORMATS")
print("="*80 + "\n")

# Check salary_accruals format
print("1. Salary accruals format:")
cur.execute("SELECT payment_id FROM salary_accruals WHERE payment_id LIKE '%032023' LIMIT 5")
for row in cur.fetchall():
    pid = row[0]
    prl_part = pid.split('_PRL')[1] if '_PRL' in pid else 'N/A'
    print(f"   {pid} → PRL{prl_part}")

# Check raw data format  
print("\n2. Raw bank data format:")
cur.execute("SELECT docinformation FROM bog_gel_raw_893486000 WHERE docinformation LIKE '%PRL032023' LIMIT 5")
for row in cur.fetchall():
    pid = row[0]
    prl_part = pid.split('_PRL')[1] if '_PRL' in pid else 'N/A'
    print(f"   {pid} → PRL{prl_part}")

# Check if any exact matches exist
print("\n3. Checking for exact matches:")
cur.execute("""
    SELECT COUNT(DISTINCT r.docinformation)
    FROM bog_gel_raw_893486000 r
    INNER JOIN salary_accruals s ON r.docinformation = s.payment_id
    WHERE r.docinformation LIKE 'NP_%_NJ_%_PRL%'
""")
exact_matches = cur.fetchone()[0]
print(f"   Exact matches: {exact_matches}")

# Check case-insensitive matches
print("\n4. Checking case-insensitive matches:")
cur.execute("""
    SELECT COUNT(*)
    FROM bog_gel_raw_893486000 r
    INNER JOIN salary_accruals s ON UPPER(r.docinformation) = UPPER(s.payment_id)
    WHERE r.docinformation LIKE 'NP_%_NJ_%_PRL%'
""")
case_insensitive = cur.fetchone()[0]
print(f"   Case-insensitive matches: {case_insensitive}")

conn.close()

print("\n" + "="*80)
