import psycopg2
from urllib.parse import urlparse

# Read Supabase connection string
with open('.env.local', 'r') as f:
    for line in f:
        if line.startswith('REMOTE_DATABASE_URL='):
            remote_url = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

parsed = urlparse(remote_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

conn = psycopg2.connect(clean_url)
cur = conn.cursor()

print("🔍 Adding columns to Supabase tables...")

# Add processing_case to consolidated table
cur.execute('ALTER TABLE consolidated_bank_accounts ADD COLUMN IF NOT EXISTS processing_case TEXT')
print("✅ Added processing_case to consolidated_bank_accounts")

# Add 8-case flags to raw table
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS counteragent_found BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS counteragent_inn_blank BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS counteragent_missing BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS payment_id_matched BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS payment_id_conflict BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS parsing_rule_applied BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS parsing_rule_conflict BOOLEAN DEFAULT FALSE')
cur.execute('ALTER TABLE bog_gel_raw_893486000 ADD COLUMN IF NOT EXISTS parsing_rule_dominance BOOLEAN DEFAULT FALSE')
print("✅ Added 8-case flags to bog_gel_raw_893486000")

conn.commit()
print("✅ All columns added successfully!")
conn.close()
