"""Check how payment IDs appear in salary_accruals and bank raw data"""
import psycopg2
from dotenv import dotenv_values
import re
from urllib.parse import urlparse

# Load environment
env = dotenv_values('.env.local')

# Clean database URL (remove query params that psycopg2 doesn't like)
db_url = env['DATABASE_URL']
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

# Connect to database
conn = psycopg2.connect(clean_url)
cur = conn.cursor()

print("="*80)
print("CHECKING PAYMENT ID PARSING ISSUE")
print("="*80)

# 1. Check salary_accruals payment IDs
print("\n1. Sample salary_accruals payment IDs:")
cur.execute("""
    SELECT payment_id 
    FROM salary_accruals 
    WHERE payment_id IS NOT NULL 
    LIMIT 10
""")
for row in cur.fetchall():
    payment_id = row[0]
    print(f"   {payment_id} (length: {len(payment_id)})")

# 2. Check the specific payment ID
print("\n2. Specific payment ID in salary_accruals:")
cur.execute("""
    SELECT payment_id, counteragent_uuid, financial_code_uuid
    FROM salary_accruals 
    WHERE payment_id = 'NP_714645_NJ_A34590_PRL102025'
""")
salary_results = cur.fetchall()
if salary_results:
    for row in salary_results:
        print(f"   Payment ID: {row[0]}")
        print(f"   Counteragent: {row[1]}")
        print(f"   Financial Code: {row[2]}")
else:
    print("   ⚠️ Payment ID 'NP_714645_NJ_A34590_PRL102025' NOT FOUND in salary_accruals!")
    print("   Searching for similar patterns...")
    cur.execute("""
        SELECT payment_id 
        FROM salary_accruals 
        WHERE payment_id LIKE '%714645%' OR payment_id LIKE '%A34590%'
        LIMIT 5
    """)
    similar = cur.fetchall()
    if similar:
        print("   Similar payment IDs found:")
        for r in similar:
            print(f"     {r[0]}")
    else:
        print("   No similar payment IDs found")

# 3. Find what raw tables exist
print("\n3. Finding available raw tables:")
cur.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE 'bog_gel_raw_%'
    ORDER BY tablename
""")
raw_tables = [row[0] for row in cur.fetchall()]
print(f"   Found {len(raw_tables)} raw tables:")
for table in raw_tables[:5]:
    print(f"     {table}")
if len(raw_tables) > 5:
    print(f"     ... and {len(raw_tables)-5} more")

# 4. Check if ANY salary payment IDs appear in raw data
if raw_tables:
    print("\n4. Checking if salary payment IDs appear in raw bank data:")
    first_table = raw_tables[0]
    cur.execute(f"""
        SELECT docinformation
        FROM {first_table}
        WHERE docinformation LIKE '%NP_%_NJ_%_PRL%'
        LIMIT 5
    """)
    raw_results = cur.fetchall()
    if raw_results:
        print(f"   Found {len(raw_results)} records with salary payment ID pattern:")
        for row in raw_results:
            print(f"     {row[0][:100]}...")
    else:
        print("   ⚠️ NO records found with salary payment ID pattern!")
        print("   Checking sample DocInformation values:")
        cur.execute(f"""
            SELECT docinformation
            FROM {first_table}
            WHERE docinformation IS NOT NULL
            LIMIT 5
        """)
        samples = cur.fetchall()
        for row in samples:
            doc = row[0] if row[0] else ""
            print(f"     {doc[:80]}...")
else:
    print("\n4. No raw tables found!")

# 4. Test extraction function
print("\n4. Testing extraction function:")

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
    
    # Strategy 4: If entire text is alphanumeric and 5-20 chars
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 20:
        return text
    
    return None

# Test with sample data
test_cases = [
    "NP_714645_NJ_A34590_PRL102025",  # Length 29 - TOO LONG for Strategy 4!
    "payment_id: NP_714645_NJ_A34590_PRL102025",
    "ID: NP_714645_NJ_A34590_PRL102025",
    "#NP_714645_NJ_A34590_PRL102025",
    "Some text NP_714645_NJ_A34590_PRL102025 more text",
    "NP_5beea0_NJ_319b2a_PRL012023"  # Actual format from DB
]

for test in test_cases:
    result = extract_payment_id(test)
    matched = "✅ MATCHED" if result else "❌ NO MATCH"
    print(f"   {matched}")
    print(f"     Input: {test[:70]}")
    print(f"     Extracted: {result}")
    print()

# 5. Check if salary payment IDs are in payments_map
print("\n5. Checking consolidated_bank_accounts for matches:")
cur.execute("""
    SELECT COUNT(*) 
    FROM consolidated_bank_accounts
    WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
""")
count = cur.fetchone()[0]
print(f"   Records with salary payment ID format: {count}")

cur.execute("""
    SELECT payment_id, COUNT(*) as cnt
    FROM consolidated_bank_accounts
    WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
    GROUP BY payment_id
    LIMIT 10
""")
print("   Sample matched payment IDs:")
for row in cur.fetchall():
    print(f"     {row[0]}: {row[1]} records")

conn.close()

print("\n" + "="*80)
print("ANALYSIS COMPLETE")
print("="*80)
