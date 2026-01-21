import psycopg2
import re
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
print("RAW DATA ANALYSIS - Searching for Salary Payment IDs")
print("="*70)

# Check raw table for salary pattern
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN docinformation ~* 'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL[0-9]{6}' THEN 1 END) as salary_match
    FROM bog_gel_raw_893486000
""")
row = cur.fetchone()
print(f"\n1. PATTERN MATCH IN RAW DATA:")
print(f"   Total raw records: {row[0]:,}")
print(f"   Records with salary pattern: {row[1]:,}")
print(f"   Percentage: {row[1]*100//row[0] if row[0] > 0 else 0}%")

# Check for _NJ_ substring (simpler check)
cur.execute("""
    SELECT COUNT(*) 
    FROM bog_gel_raw_893486000 
    WHERE docinformation LIKE '%_NJ_%'
""")
nj_count = cur.fetchone()[0]
print(f"\n2. SIMPLE '_NJ_' SUBSTRING CHECK:")
print(f"   Records containing '_NJ_': {nj_count:,}")

# Show sample DocInformation fields
print(f"\n3. SAMPLE DOC_INFORMATION FIELDS (first 20 non-null):")
cur.execute("""
    SELECT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation IS NOT NULL AND docinformation != ''
    LIMIT 20
""")
samples = cur.fetchall()
for i, (doc_info,) in enumerate(samples, 1):
    # Check if it looks like a payment ID
    is_salary = bool(re.search(r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}', doc_info, re.IGNORECASE))
    marker = " ← SALARY FORMAT!" if is_salary else ""
    print(f"   {i}. {doc_info[:80]}{marker}")

# Check record 329679 specifically
print(f"\n4. CHECKING RECORD ID 329679 (mentioned by user):")
cur.execute("""
    SELECT doc_key, entries_id, docinformation, counteragent_processed
    FROM bog_gel_raw_893486000
    ORDER BY id
    LIMIT 1 OFFSET 329678
""")
rec = cur.fetchone()
if rec:
    print(f"   DocKey: {rec[0]}")
    print(f"   EntriesId: {rec[1]}")
    print(f"   DocInformation: {rec[2] or 'NULL'}")
    print(f"   Counteragent Processed: {rec[3]}")

cur.close()
conn.close()

print("\n" + "="*70)
