import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
from decimal import Decimal
import sys

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
    sys.exit(1)

if not db_url:
    raise ValueError("REMOTE_DATABASE_URL not found in .env.local")

# Parse and clean connection string
parsed = urlparse(db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print("🔍 Connecting to Supabase PostgreSQL...")
conn = psycopg2.connect(clean_url)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cursor = conn.cursor(cursor_factory=RealDictCursor)

# Load NBG rates
print("📈 Loading NBG rates...")
cursor.execute("""
    SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
""")
nbg_rates_map = {}
for row in cursor.fetchall():
    date_key = row['date'].strftime('%Y-%m-%d')
    nbg_rates_map[date_key] = {
        'USD': row['usd_rate'],
        'EUR': row['eur_rate'],
        'CNY': row['cny_rate'],
        'GBP': row['gbp_rate'],
        'RUB': row['rub_rate'],
        'TRY': row['try_rate'],
        'AED': row['aed_rate'],
        'KZT': row['kzt_rate']
    }
print(f"✅ Loaded NBG rates for {len(nbg_rates_map)} dates")

# Fetch all transactions that need correction
print("\n🔄 Fetching transactions to fix...")
cursor.execute("""
    SELECT 
        uuid,
        account_currency_amount,
        nominal_amount,
        nominal_currency_uuid,
        date
    FROM consolidated_bank_accounts
    ORDER BY date DESC
""")

transactions = cursor.fetchall()
print(f"📦 Found {len(transactions)} transactions to process")

updates = []
fixed_with_payment = 0
fixed_without_payment = 0

for txn in transactions:
    uuid = txn['uuid']
    account_currency_amount = txn['account_currency_amount']
    current_nominal_amount = txn['nominal_amount']
    nominal_currency_uuid = txn['nominal_currency_uuid']
    txn_date = txn['date']
    
    new_nominal_amount = None
    
    if nominal_currency_uuid:
        # Has payment match - recalculate with correct sign
        cursor.execute("SELECT code FROM currencies WHERE uuid = %s", (nominal_currency_uuid,))
        curr_result = cursor.fetchone()
        
        if curr_result:
            nominal_currency_code = curr_result['code']
            
            if nominal_currency_code == 'GEL':
                # GEL: preserve sign
                new_nominal_amount = account_currency_amount
                fixed_with_payment += 1
            elif nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
                # Foreign currency: convert with sign
                date_key = txn_date.strftime('%Y-%m-%d')
                if date_key in nbg_rates_map:
                    rate = nbg_rates_map[date_key].get(nominal_currency_code)
                    if rate and rate > 0:
                        new_nominal_amount = account_currency_amount * (Decimal('1') / rate)
                        fixed_with_payment += 1
    else:
        # No payment match: nominal = account currency amount
        new_nominal_amount = account_currency_amount
        fixed_without_payment += 1
    
    # Update if changed
    if new_nominal_amount is not None and new_nominal_amount != current_nominal_amount:
        updates.append((new_nominal_amount, uuid))

print(f"\n📊 Analysis:")
print(f"  ✅ Transactions with payment (recalculated): {fixed_with_payment}")
print(f"  ✅ Transactions without payment (set to account amount): {fixed_without_payment}")
print(f"  🔄 Total updates needed: {len(updates)}")

# Apply updates
if updates:
    print(f"\n💾 Updating {len(updates)} transactions...")
    
    update_query = """
        UPDATE consolidated_bank_accounts
        SET nominal_amount = %s, updated_at = CURRENT_TIMESTAMP
        WHERE uuid = %s
    """
    
    for nominal_amount, uuid in updates:
        cursor.execute(update_query, (nominal_amount, uuid))
    
    print(f"✅ Successfully updated {len(updates)} transactions!")
else:
    print("\n✅ No updates needed - all transactions are correct!")

cursor.close()
conn.close()

print("\n✅ Fix completed!")
