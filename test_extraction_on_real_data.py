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
print("TESTING PAYMENT ID EXTRACTION")
print("="*70)

# Get samples with salary pattern
cur.execute("""
    SELECT docinformation
    FROM bog_gel_raw_893486000
    WHERE docinformation ~* 'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL[0-9]{6}'
    LIMIT 10
""")
samples = cur.fetchall()

print(f"\nFound {len(samples)} samples with salary pattern\n")

# Test extraction function (copied from script)
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
    
    # Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars)
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:
        return text
    
    return None

# Test on each sample
for i, (doc_info,) in enumerate(samples, 1):
    extracted = extract_payment_id(doc_info)
    print(f"{i}. Input: {doc_info}")
    print(f"   Extracted: {extracted}")
    print()

cur.close()
conn.close()

print("="*70)
