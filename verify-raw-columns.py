import psycopg2
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
import sys

# Read REMOTE_DATABASE_URL from .env.local
db_url = None
try:
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('REMOTE_DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip('"').strip("'")
                break
except Exception as e:
    print(f"Error reading .env.local: {e}")
    sys.exit(1)

if not db_url:
    raise ValueError("REMOTE_DATABASE_URL not found in .env.local")

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

# Connect to Supabase
conn = psycopg2.connect(clean_url)
cursor = conn.cursor(cursor_factory=RealDictCursor)

# Check raw table columns
print("\n✅ Verifying exact XML tag names in raw table:\n")
cursor.execute("""
    SELECT DocKey, EntriesId, DocNomination, EntryCrAmt, EntryDbAmt,
           DocSenderInn, DocBenefInn, DocValueDate
    FROM bog_gel_raw_893486000 
    LIMIT 3
""")

rows = cursor.fetchall()
for row in rows:
    print(f"DocKey: {row['dockey']}")
    print(f"EntriesId: {row['entriesid']}")
    print(f"DocNomination: {row['docnomination']}")
    print(f"EntryCrAmt: {row['entrycramt']}")
    print(f"EntryDbAmt: {row['entrydbamt']}")
    print(f"DocSenderInn: {row['docsenderinn']}")
    print(f"DocBenefInn: {row['docbenefinn']}")
    print(f"DocValueDate: {row['docvaluedate']}")
    print("-" * 50)

cursor.close()
conn.close()

print("\n✅ Verification complete!")
