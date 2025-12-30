import psycopg2
from urllib.parse import urlparse

# Read DATABASE_URL from .env.local
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

print(f"📡 Connection string: {db_url[:50]}...")

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(clean_url)
cursor = conn.cursor()

# Get ALL bank accounts with no filters
cursor.execute("""
    SELECT uuid, account_number, currency_uuid, is_active
    FROM bank_accounts
    ORDER BY created_at DESC
    LIMIT 20
""")

accounts = cursor.fetchall()
print(f"\n📋 All bank accounts in Supabase ({len(accounts)}):")
for acc in accounts:
    print(f"   UUID: {acc[0]}")
    print(f"   Account: {acc[1]}")
    print(f"   Currency UUID: {acc[2]}")
    print(f"   Active: {acc[3]}")
    print()

# Check the specific UUID
cursor.execute("""
    SELECT uuid, account_number, currency_uuid
    FROM bank_accounts
    WHERE uuid::text = '60582948-8c5b-4715-b75c-ca03e3d36a4e'
""")

specific = cursor.fetchone()
if specific:
    print(f"✅ Found account with UUID 60582948-8c5b-4715-b75c-ca03e3d36a4e:")
    print(f"   Account Number: {specific[1]}")
    print(f"   Currency UUID: {specific[2]}")
else:
    print("❌ Account with that UUID not found")

cursor.close()
conn.close()
