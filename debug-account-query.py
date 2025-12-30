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

# Check the exact account
account_number = "GE78BG0000000893486000"
print(f"\n🔍 Looking for account: {account_number}")

# First check if account exists at all
cursor.execute("""
    SELECT uuid, account_number, currency_uuid
    FROM bank_accounts 
    WHERE account_number = %s
""", (account_number,))

result = cursor.fetchone()
if result:
    print(f"\n✅ Found account:")
    print(f"   UUID: {result[0]}")
    print(f"   Account Number: {result[1]}")
    print(f"   Currency UUID: {result[2]}")
    
    # Now check what currency this is
    cursor.execute("""
        SELECT code, uuid, name
        FROM currencies 
        WHERE uuid = %s
    """, (result[2],))
    
    curr_result = cursor.fetchone()
    if curr_result:
        print(f"\n💱 Currency details:")
        print(f"   Code: {curr_result[0]}")
        print(f"   UUID: {curr_result[1]}")
        print(f"   Name: {curr_result[2]}")
    else:
        print(f"\n❌ Currency with UUID {result[2]} not found!")
else:
    print(f"\n❌ Account not found")

# Check if GEL currency exists
cursor.execute("SELECT uuid, code, name FROM currencies WHERE code = 'GEL'")
gel_result = cursor.fetchone()
if gel_result:
    print(f"\n✅ GEL currency exists:")
    print(f"   UUID: {gel_result[0]}")
    print(f"   Code: {gel_result[1]}")
    print(f"   Name: {gel_result[2]}")
else:
    print(f"\n❌ GEL currency not found in database!")

# Try the original query
cursor.execute("""
    SELECT ba.uuid, ba.currency_uuid
    FROM bank_accounts ba
    JOIN currencies c ON ba.currency_uuid = c.uuid
    WHERE ba.account_number = %s AND c.code = %s
""", (account_number, 'GEL'))

final_result = cursor.fetchone()
if final_result:
    print(f"\n✅ Original query WORKS:")
    print(f"   Account UUID: {final_result[0]}")
    print(f"   Currency UUID: {final_result[1]}")
else:
    print(f"\n❌ Original query FAILED - no match found")

cursor.close()
conn.close()
