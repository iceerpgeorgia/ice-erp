import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse, parse_qs

# Read DATABASE_URL directly from .env.local file
db_url = None
try:
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip('"').strip("'")
                break
except Exception as e:
    print(f"Error reading .env.local: {e}")

if not db_url:
    raise ValueError("DATABASE_URL not found in .env.local")

# Parse the connection string and remove the schema parameter
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")

# Connect to database
conn = psycopg2.connect(clean_url)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

print("📊 Creating consolidated_bank_accounts table...")

# Read and execute migration
with open('prisma/migrations/20251227000001_add_consolidated_bank_accounts/migration.sql', 'r') as f:
    migration_sql = f.read()
    cursor.execute(migration_sql)

print("✅ Migration applied successfully!")

# Verify table exists
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consolidated_bank_accounts'
    ORDER BY ordinal_position;
""")

columns = cursor.fetchall()
print(f"\n📋 Table structure ({len(columns)} columns):")
for col in columns:
    print(f"  - {col[0]}: {col[1]}")

cursor.close()
conn.close()

print("\n✅ Done!")
