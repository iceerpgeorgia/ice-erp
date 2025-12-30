import psycopg2

# Try local database
local_url = "postgresql://postgres:123456@localhost:5432/ICE_ERP"

print("🔍 Connecting to LOCAL PostgreSQL...")
conn = psycopg2.connect(local_url)
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
    print(f"\n✅ Found bank account in LOCAL database:")
    print(f"   UUID: {result[0]}")
    print(f"   Account Number: {result[1]}")
    print(f"   Currency Code: {result[2]}")
    print(f"   Currency UUID: {result[3]}")
else:
    print(f"\n❌ Account not found in local database")

# Check all bank accounts
cursor.execute("""
    SELECT ba.uuid, ba.account_number, c.code
    FROM bank_accounts ba
    JOIN currencies c ON ba.currency_uuid = c.uuid
""")

accounts = cursor.fetchall()
print(f"\n📋 All bank accounts in LOCAL database ({len(accounts)}):")
for acc in accounts[:10]:  # First 10
    print(f"   - {acc[1]} ({acc[2]}) - UUID: {acc[0]}")

cursor.close()
conn.close()
