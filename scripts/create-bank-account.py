import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse
import sys

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
    sys.exit(1)

if not db_url:
    raise ValueError("DATABASE_URL not found in .env.local")

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(clean_url)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor()

# Get account number and currency from command line
if len(sys.argv) < 3:
    print("Usage: python create-bank-account.py <account_number> <currency_code> [bank_name]")
    print("Example: python create-bank-account.py GE78BG0000000893486000 GEL BOG")
    sys.exit(1)

account_number = sys.argv[1]
currency_code = sys.argv[2]
bank_name = sys.argv[3] if len(sys.argv) > 3 else None

print(f"\n📊 Creating bank account:")
print(f"  Account: {account_number}")
print(f"  Currency: {currency_code}")
print(f"  Bank: {bank_name or 'None'}")

# Get currency UUID
cursor.execute("SELECT uuid FROM currencies WHERE code = %s", (currency_code,))
currency_result = cursor.fetchone()

if not currency_result:
    print(f"❌ Currency not found: {currency_code}")
    sys.exit(1)

currency_uuid = currency_result[0]
print(f"✅ Currency UUID: {currency_uuid}")

# Get or create bank UUID
bank_uuid = None
if bank_name:
    cursor.execute("SELECT uuid FROM banks WHERE bank_name = %s", (bank_name,))
    bank_result = cursor.fetchone()
    
    if bank_result:
        bank_uuid = bank_result[0]
        print(f"✅ Bank UUID: {bank_uuid}")
    else:
        cursor.execute("""
            INSERT INTO banks (bank_name) 
            VALUES (%s) 
            RETURNING uuid
        """, (bank_name,))
        bank_uuid = cursor.fetchone()[0]
        print(f"✅ Created bank: {bank_name} ({bank_uuid})")

# Check if account already exists
cursor.execute("""
    SELECT uuid FROM bank_accounts 
    WHERE account_number = %s AND currency_uuid = %s
""", (account_number, currency_uuid))

existing = cursor.fetchone()
if existing:
    print(f"\n⚠️  Account already exists: {existing[0]}")
    sys.exit(0)

# Create bank account
cursor.execute("""
    INSERT INTO bank_accounts (account_number, currency_uuid, bank_uuid) 
    VALUES (%s, %s, %s) 
    RETURNING uuid
""", (account_number, currency_uuid, bank_uuid))

account_uuid = cursor.fetchone()[0]
print(f"\n✅ Bank account created successfully!")
print(f"   UUID: {account_uuid}")

cursor.close()
conn.close()
