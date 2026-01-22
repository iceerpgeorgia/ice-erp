import psycopg2

# Read and parse connection
with open('.env.local', 'r') as f:
    for line in f:
        if 'REMOTE_DATABASE_URL=' in line:
            url = line.split('=', 1)[1].strip().strip('"').strip("'")
            url = url.replace(':6543/', ':5432/')
            break

from urllib.parse import urlparse
p = urlparse(url)
conn = psycopg2.connect(f"{p.scheme}://{p.netloc}{p.path}")
cur = conn.cursor()

print("\n" + "="*70)
print("CONSOLIDATED RECORDS BY BANK ACCOUNT")
print("="*70)
cur.execute("""
    SELECT 
        bank_account_uuid,
        COUNT(*) as cnt
    FROM consolidated_bank_accounts 
    GROUP BY bank_account_uuid 
    ORDER BY cnt DESC
""")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]:,} records")

print("\n" + "="*70)
print("TOTAL COUNTS")
print("="*70)
cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
print(f"  Consolidated total: {cur.fetchone()[0]:,}")

cur.execute("SELECT COUNT(*) FROM bog_gel_raw_893486000")
print(f"  Raw table (bog_gel_raw_893486000): {cur.fetchone()[0]:,}")

print("\n" + "="*70)
print("RAW TABLES IN DATABASE")
print("="*70)
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'bog_gel_raw_%'
""")
for row in cur.fetchall():
    try:
        cur.execute(f"SELECT COUNT(*) FROM {row[0]}")
        print(f"  {row[0]}: {cur.fetchone()[0]:,} records")
    except:
        print(f"  {row[0]}: (error)")

conn.close()
print()
