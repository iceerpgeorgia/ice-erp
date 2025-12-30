import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse

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

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(clean_url)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

print("\n🗑️  Dropping old raw table and truncating consolidated...")

# Drop old table
cursor.execute("DROP TABLE IF EXISTS bog_gel_raw_893486000 CASCADE")
print("✅ Dropped bog_gel_raw_893486000")

# Truncate consolidated
cursor.execute("TRUNCATE TABLE consolidated_bank_accounts CASCADE")
print("✅ Truncated consolidated_bank_accounts")

# Create new raw table with exact XML tag names
print("\n📊 Creating raw table with exact XML tag names...")

cursor.execute("""
CREATE TABLE bog_gel_raw_893486000 (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    
    -- Exact XML tags as they appear
    CanCopyDocument TEXT,
    CanViewDocument TEXT,
    CanPrintDocument TEXT,
    IsReval TEXT,
    DocNomination TEXT,
    DocInformation TEXT,
    DocSrcAmt TEXT,
    DocSrcCcy TEXT,
    DocDstAmt TEXT,
    DocDstCcy TEXT,
    DocKey TEXT,
    DocRecDate TEXT,
    DocBranch TEXT,
    DocDepartment TEXT,
    DocProdGroup TEXT,
    DocNo TEXT,
    DocValueDate TEXT,
    DocSenderName TEXT,
    DocSenderInn TEXT,
    DocSenderAcctNo TEXT,
    DocSenderBic TEXT,
    DocActualDate TEXT,
    DocCorAcct TEXT,
    DocCorBic TEXT,
    DocCorBankName TEXT,
    EntriesId TEXT,
    DocComment TEXT,
    CcyRate TEXT,
    EntryPDate TEXT,
    EntryDocNo TEXT,
    EntryLAcct TEXT,
    EntryLAcctOld TEXT,
    EntryDbAmt TEXT,
    EntryDbAmtBase TEXT,
    EntryCrAmt TEXT,
    EntryCrAmtBase TEXT,
    OutBalance TEXT,
    EntryAmtBase TEXT,
    EntryComment TEXT,
    EntryDepartment TEXT,
    EntryAcctPoint TEXT,
    DocSenderBicName TEXT,
    DocBenefName TEXT,
    DocBenefInn TEXT,
    DocBenefAcctNo TEXT,
    DocBenefBic TEXT,
    DocBenefBicName TEXT,
    DocPayerName TEXT,
    DocPayerInn TEXT,
    
    -- Import metadata
    import_batch_id TEXT,
    import_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_processed BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""")

cursor.execute("""
CREATE UNIQUE INDEX bog_gel_raw_893486000_DocKey_EntriesId_key 
ON bog_gel_raw_893486000(DocKey, EntriesId) 
WHERE DocKey IS NOT NULL AND EntriesId IS NOT NULL
""")

cursor.execute("CREATE INDEX bog_gel_raw_893486000_is_processed_idx ON bog_gel_raw_893486000(is_processed)")
cursor.execute("CREATE INDEX bog_gel_raw_893486000_import_batch_id_idx ON bog_gel_raw_893486000(import_batch_id)")
cursor.execute("CREATE INDEX bog_gel_raw_893486000_DocRecDate_idx ON bog_gel_raw_893486000(DocRecDate)")

print("✅ Created bog_gel_raw_893486000 with exact XML tag names")

cursor.close()
conn.close()

print("\n✅ Done!")
