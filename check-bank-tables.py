import psycopg2
from urllib.parse import urlparse

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
conn = psycopg2.connect(clean_url)
cursor = conn.cursor()

# Check for bank-related tables
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('banks', 'bank_accounts', 'consolidated_bank_accounts')
    ORDER BY table_name;
""")

tables = cursor.fetchall()
print(f"\n📋 Bank-related tables in Supabase:")
if tables:
    for table in tables:
        print(f"  ✓ {table[0]}")
else:
    print("  ❌ No bank tables found")

cursor.close()
conn.close()
