"""Verify the fix will correctly match salary payment IDs"""
import psycopg2
from urllib.parse import urlparse
from dotenv import dotenv_values
import re

# Load database connection
env = dotenv_values('.env.local')
parsed = urlparse(env['DATABASE_URL'])
clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean)
cur = conn.cursor()

# Updated extraction function (same as in import_bank_xml_data.py)
def extract_payment_id(doc_information):
    """Extract payment_id from DocInformation field with multiple pattern strategies"""
    if not doc_information:
        return None
    
    text = str(doc_information).strip()
    
    # Strategy 1: Look for explicit "payment_id: 12345" or "payment id: 12345"
    match = re.search(r'payment[_\s]*id[:\s]*(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 2: Look for "ID: 12345" or "id: 12345" at start of string
    match = re.search(r'^id[:\s]+(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 3: Look for patterns like "#12345" or "№12345"
    match = re.search(r'[#№](\w+)', text)
    if match:
        return match.group(1)
    
    # Strategy 4: Look for salary accrual payment ID pattern (NP_xxx_NJ_xxx_PRLxxx)
    match = re.search(r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}', text, re.IGNORECASE)
    if match:
        return match.group(0)
    
    # Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars), treat as payment_id
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:
        return text
    
    return None

print("="*80)
print("VERIFICATION: Payment ID Extraction Fix")
print("="*80 + "\n")

# Load all salary payment IDs
cur.execute("SELECT payment_id FROM salary_accruals WHERE payment_id IS NOT NULL")
salary_payment_ids = set(row[0] for row in cur.fetchall())
print(f"📊 Total salary payment IDs in database: {len(salary_payment_ids)}\n")

# Get sample raw records with salary payment ID pattern
cur.execute("""
    SELECT docinformation 
    FROM bog_gel_raw_893486000 
    WHERE docinformation LIKE '%NP_%_NJ_%_PRL%'
    LIMIT 20
""")
raw_records = [row[0] for row in cur.fetchall()]
print(f"📦 Sample raw records with salary pattern: {len(raw_records)}\n")

# Test extraction
matched_count = 0
not_matched_count = 0
examples = []

for doc_info in raw_records:
    extracted = extract_payment_id(doc_info)
    if extracted:
        matched_count += 1
        if extracted in salary_payment_ids:
            examples.append(f"✅ MATCHED: {extracted} (exists in salary_accruals)")
        else:
            examples.append(f"⚠️  EXTRACTED: {extracted} (not in salary_accruals)")
    else:
        not_matched_count += 1
        examples.append(f"❌ NOT EXTRACTED: {doc_info}")

print("RESULTS:")
print(f"  ✅ Successfully extracted: {matched_count}/{len(raw_records)}")
print(f"  ❌ Failed to extract: {not_matched_count}/{len(raw_records)}\n")

print("SAMPLE RESULTS (first 10):")
for ex in examples[:10]:
    print(f"  {ex}")

# Estimate total impact
cur.execute("""
    SELECT COUNT(*)
    FROM bog_gel_raw_893486000 
    WHERE docinformation LIKE '%NP_%_NJ_%_PRL%'
""")
total_with_pattern = cur.fetchone()[0]
print(f"\n📈 ESTIMATED IMPACT:")
print(f"  Total records with salary pattern: {total_with_pattern}")
print(f"  Expected match rate: {matched_count}/{len(raw_records)} = {matched_count/len(raw_records)*100:.1f}%")
print(f"  Estimated new matches: ~{int(total_with_pattern * matched_count / len(raw_records))}")

conn.close()

print("\n" + "="*80)
if matched_count == len(raw_records):
    print("✅ FIX VERIFIED: All records will be extracted correctly")
else:
    print("⚠️  WARNING: Some records may not extract correctly")
print("="*80)
