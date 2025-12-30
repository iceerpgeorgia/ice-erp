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

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(clean_url)
cursor = conn.cursor()

# Check the specific bank account
cursor.execute("""
    SELECT ba.uuid, ba.account_number, c.code, c.uuid
    FROM bank_accounts ba
    JOIN currencies c ON ba.currency_uuid = c.uuid
    WHERE ba.uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e'
""")

result = cursor.fetchone()
if result:
    print(f"\n✅ Found bank account:")
    print(f"   UUID: {result[0]}")
    print(f"   Account Number: {result[1]}")
    print(f"   Currency Code: {result[2]}")
    print(f"   Currency UUID: {result[3]}")
else:
    print(f"\n❌ Account with UUID 60582948-8c5b-4715-b75c-ca03e3d36a4e not found")

# Check all bank accounts with GEL
cursor.execute("""
    SELECT ba.uuid, ba.account_number, c.code
    FROM bank_accounts ba
    JOIN currencies c ON ba.currency_uuid = c.uuid
    WHERE c.code = 'GEL'
""")

accounts = cursor.fetchall()
print(f"\n📋 All GEL bank accounts ({len(accounts)}):")
for acc in accounts:
    print(f"   - {acc[1]} ({acc[2]}) - UUID: {acc[0]}")

# Check if the specific account number exists
cursor.execute("""
    SELECT ba.uuid, ba.account_number, c.code
    FROM bank_accounts ba
    JOIN currencies c ON ba.currency_uuid = c.uuid
    WHERE ba.account_number LIKE '%893486000%'
""")

matching = cursor.fetchall()
print(f"\n🔍 Accounts matching '893486000':")
for acc in matching:
    print(f"   - {acc[1]} ({acc[2]}) - UUID: {acc[0]}")

cursor.close()
conn.close()
