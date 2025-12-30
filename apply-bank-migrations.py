import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse

# Read REMOTE_DATABASE_URL directly from .env.local file
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

if not db_url:
    raise ValueError("REMOTE_DATABASE_URL not found in .env.local")

# Parse the connection string and remove the schema parameter
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")

# Connect to database
conn = psycopg2.connect(clean_url)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

migrations = [
    ('20251226000000_add_bank_accounts_table', 'Bank accounts table'),
    ('20251226000001_add_banks_table', 'Banks table'),
    ('20251227000001_add_consolidated_bank_accounts', 'Consolidated bank accounts table'),
    ('20251228000001_add_bog_gel_raw_893486000', 'BOG_GEL raw table for account 893486000'),
]

for migration_name, description in migrations:
    print(f"\n📊 Applying migration: {description}...")
    
    # Read and execute migration
    with open(f'prisma/migrations/{migration_name}/migration.sql', 'r') as f:
        migration_sql = f.read()
        try:
            cursor.execute(migration_sql)
            print(f"  ✅ {description} created successfully")
        except psycopg2.errors.DuplicateTable as e:
            print(f"  ⚠️  {description} already exists, skipping")
        except Exception as e:
            print(f"  ❌ Error: {e}")
            raise

print("\n✅ All migrations applied successfully!")

# Verify tables exist
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('banks', 'bank_accounts', 'consolidated_bank_accounts')
    ORDER BY table_name;
""")

tables = cursor.fetchall()
print(f"\n📋 Bank tables in Supabase ({len(tables)}):")
for table in tables:
    print(f"  ✓ {table[0]}")

cursor.close()
conn.close()

print("\n✅ Done!")
