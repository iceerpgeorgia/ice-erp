"""Test currency conversion calculation directly"""
import psycopg2
from decimal import Decimal
from datetime import datetime

# Database connection
LOCAL_DB = {
    'dbname': 'ICE_ERP',
    'user': 'postgres',
    'password': 'fulebimojviT1985%',
    'host': 'localhost',
    'port': '5432'
}

def calculate_nominal_amount(account_currency_amount, account_currency_code, nominal_currency_uuid, 
                             transaction_date, nbg_rates_map, local_cursor):
    """
    Calculate nominal amount using NBG exchange rates.
    
    NBG rates represent: 1 foreign currency unit = X GEL
    For example: 1 USD = 2.8 GEL means usd_rate = 2.8
    
    Conversion formulas:
    - GEL → Foreign Currency: gel_amount / rate = foreign_amount
      Example: 1000 GEL / 2.8 = 357.14 USD
    - Foreign Currency → GEL: foreign_amount * rate = gel_amount  
      Example: 357.14 USD * 2.8 = 1000 GEL
    - Same currencies: No conversion
    """
    # Default to account currency amount
    nominal_amount = account_currency_amount
    
    print(f"\n🔍 DEBUG calculate_nominal_amount:")
    print(f"   Account Amount: {account_currency_amount}")
    print(f"   Account Currency: {account_currency_code}")
    print(f"   Nominal Currency UUID: {nominal_currency_uuid}")
    print(f"   Transaction Date: {transaction_date}")
    
    if not nominal_currency_uuid:
        print(f"   ❌ No nominal_currency_uuid")
        return nominal_amount
    
    # Get nominal currency code
    local_cursor.execute("SELECT code FROM currencies WHERE uuid = %s", (nominal_currency_uuid,))
    nom_curr_result = local_cursor.fetchone()
    if not nom_curr_result:
        print(f"   ❌ Currency UUID not found in database")
        return nominal_amount
    
    nominal_currency_code = nom_curr_result[0]
    print(f"   Nominal Currency: {nominal_currency_code}")
    
    # If account currency is same as nominal currency, no conversion needed
    if account_currency_code == nominal_currency_code:
        print(f"   ℹ️ Same currency, no conversion")
        return account_currency_amount
    
    # Get NBG rate for the date
    date_key = transaction_date.strftime('%Y-%m-%d')
    print(f"   Date Key: {date_key}")
    print(f"   NBG rates available: {list(nbg_rates_map.keys())[:5]}...")
    
    if date_key not in nbg_rates_map:
        # No rate available for this date, return original amount
        print(f"   ❌ No NBG rate for date {date_key}")
        return account_currency_amount
    
    print(f"   Rates for {date_key}: {nbg_rates_map[date_key]}")
    
    # Case 1: GEL account → Foreign nominal currency (divide by rate)
    if account_currency_code == 'GEL' and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
        rate = nbg_rates_map[date_key].get(nominal_currency_code)
        print(f"   💱 GEL → {nominal_currency_code}")
        print(f"   Rate: {rate}")
        if rate and rate > 0:
            # GEL → Foreign: divide by rate
            nominal_amount = account_currency_amount / Decimal(str(rate))
            print(f"   Formula: {account_currency_amount} / {rate} = {nominal_amount}")
            print(f"   ✅ Converted!")
        else:
            print(f"   ❌ Invalid rate")
    
    # Case 2: Foreign account → GEL nominal currency (multiply by rate)
    elif account_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT'] and nominal_currency_code == 'GEL':
        rate = nbg_rates_map[date_key].get(account_currency_code)
        print(f"   💱 {account_currency_code} → GEL")
        print(f"   Rate: {rate}")
        if rate and rate > 0:
            # Foreign → GEL: multiply by rate
            nominal_amount = account_currency_amount * Decimal(str(rate))
            print(f"   Formula: {account_currency_amount} * {rate} = {nominal_amount}")
            print(f"   ✅ Converted!")
        else:
            print(f"   ❌ Invalid rate")
    
    # Case 3: Foreign → Different Foreign (convert through GEL)
    elif account_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT'] and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
        account_rate = nbg_rates_map[date_key].get(account_currency_code)
        nominal_rate = nbg_rates_map[date_key].get(nominal_currency_code)
        print(f"   💱 {account_currency_code} → {nominal_currency_code} (via GEL)")
        print(f"   Account Rate: {account_rate}, Nominal Rate: {nominal_rate}")
        if account_rate and nominal_rate and account_rate > 0 and nominal_rate > 0:
            # Convert to GEL first, then to target currency
            gel_amount = account_currency_amount * Decimal(str(account_rate))
            nominal_amount = gel_amount / Decimal(str(nominal_rate))
            print(f"   Formula: ({account_currency_amount} * {account_rate}) / {nominal_rate} = {nominal_amount}")
            print(f"   ✅ Converted!")
        else:
            print(f"   ❌ Invalid rates")
    else:
        print(f"   ℹ️ No conversion rule matched")
    
    return nominal_amount

# Connect to database
local_conn = psycopg2.connect(**LOCAL_DB)
local_cursor = local_conn.cursor()

# Load NBG rates
print("Loading NBG exchange rates...")
local_cursor.execute("""
    SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
""")
nbg_rates_map = {}
for row in local_cursor.fetchall():
    date_key = row[0].strftime('%Y-%m-%d')
    nbg_rates_map[date_key] = {
        'USD': row[1],
        'EUR': row[2],
        'CNY': row[3],
        'GBP': row[4],
        'RUB': row[5],
        'TRY': row[6],
        'AED': row[7],
        'KZT': row[8]
    }
print(f"Loaded {len(nbg_rates_map)} dates of NBG rates\n")

# Get a transaction with GEL → USD
print("Getting test transaction from consolidated_bank_accounts...")
local_cursor.execute("""
    SELECT 
        cba.id,
        cba.transaction_date,
        cba.account_currency_amount,
        cba.nominal_amount,
        cba.nominal_currency_uuid,
        ba.account_number,
        ba_curr.code as account_currency
    FROM consolidated_bank_accounts cba
    JOIN bank_accounts ba ON cba.bank_account_uuid = ba.uuid
    JOIN currencies ba_curr ON ba.currency_uuid = ba_curr.uuid
    WHERE ba_curr.code = 'GEL' 
      AND cba.payment_id IS NOT NULL
    ORDER BY cba.id DESC
    LIMIT 1
""")

result = local_cursor.fetchone()
if result:
    txn_id, txn_date, acct_amount, stored_nominal, nom_curr_uuid, acct_num, acct_curr = result
    
    print(f"Transaction ID: {txn_id}")
    print(f"Date: {txn_date}")
    print(f"Account: {acct_num} ({acct_curr})")
    print(f"Account Amount: {acct_amount}")
    print(f"Stored Nominal Amount: {stored_nominal}")
    
    # Calculate what nominal amount should be
    calculated_nominal = calculate_nominal_amount(
        acct_amount,
        acct_curr,
        nom_curr_uuid,
        txn_date,
        nbg_rates_map,
        local_cursor
    )
    
    print(f"\n📊 RESULT:")
    print(f"   Stored in DB: {stored_nominal}")
    print(f"   Calculated: {calculated_nominal}")
    print(f"   Match: {'✅ YES' if abs(stored_nominal - calculated_nominal) < Decimal('0.01') else '❌ NO'}")

local_cursor.close()
local_conn.close()
