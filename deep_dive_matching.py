"""Deep dive into why salary payment IDs aren't matching"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values
import re

env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean)
cur = conn.cursor()

print("="*80)
print("DEEP DIVE: Why No Salary Payment ID Matches?")
print("="*80 + "\n")

# 1. Check raw table payment_id_matched flag
print("1. Checking raw table payment_id_matched flags:")
cur.execute("""
    SELECT payment_id_matched, COUNT(*)
    FROM bog_gel_raw_893486000
    GROUP BY payment_id_matched
""")
for row in cur.fetchall():
    print(f"   payment_id_matched={row[0]}: {row[1]} records")

# 2. Check if DocInformation is being extracted at all
print("\n2. Sample DocInformation values with salary pattern:")
cur.execute("""
    SELECT docinformation, payment_id_matched
    FROM bog_gel_raw_893486000
    WHERE docinformation LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 5
""")
for row in cur.fetchall():
    print(f"   DocInfo: {row[0]}")
    print(f"   Matched: {row[1]}")
    print()

# 3. Test extraction function on actual data
def extract_payment_id(doc_information):
    """Extract payment_id from DocInformation field"""
    if not doc_information:
        return None
    
    text = str(doc_information).strip()
    
    # Strategy 1: Look for explicit "payment_id: 12345"
    match = re.search(r'payment[_\s]*id[:\s]*(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 2: Look for "ID: 12345" at start
    match = re.search(r'^id[:\s]+(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 3: Look for "#12345" or "№12345"
    match = re.search(r'[#№](\w+)', text)
    if match:
        return match.group(1)
    
    # Strategy 4: Look for salary accrual pattern
    match = re.search(r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}', text, re.IGNORECASE)
    if match:
        return match.group(0)
    
    # Strategy 5: If entire text is alphanumeric and 5-50 chars
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:
        return text
    
    return None

print("3. Testing extraction on actual data:")
cur.execute("""
    SELECT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 5
""")
for row in cur.fetchall():
    doc = row[0]
    extracted = extract_payment_id(doc)
    status = "✅" if extracted else "❌"
    print(f"   {status} Input: {doc}")
    print(f"      Extracted: {extracted}")

# 4. Check if extracted IDs exist in salary_accruals
print("\n4. Checking if extracted IDs exist in salary_accruals:")
cur.execute("""
    SELECT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 10
""")
extracted_ids = []
for row in cur.fetchall():
    doc = row[0]
    extracted = extract_payment_id(doc)
    if extracted:
        extracted_ids.append(extracted)

if extracted_ids:
    print(f"   Extracted {len(extracted_ids)} payment IDs")
    # Check each one
    for pid in extracted_ids[:5]:
        cur.execute("SELECT COUNT(*) FROM salary_accruals WHERE payment_id = %s", (pid,))
        count = cur.fetchone()[0]
        status = "✅ EXISTS" if count > 0 else "❌ NOT FOUND"
        print(f"   {status} in salary_accruals: {pid}")

# 5. Check case sensitivity
print("\n5. Testing case sensitivity:")
cur.execute("""
    SELECT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 1
""")
sample_raw = cur.fetchone()[0]
print(f"   Raw payment ID: {sample_raw}")

cur.execute("SELECT payment_id FROM salary_accruals LIMIT 1")
sample_salary = cur.fetchone()[0]
print(f"   Salary payment ID: {sample_salary}")

print(f"\n   Raw format: {sample_raw}")
print(f"   Salary format: {sample_salary}")

conn.close()

print("\n" + "="*80)
