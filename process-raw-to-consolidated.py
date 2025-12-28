import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import RealDictCursor
from urllib.parse import urlparse
from datetime import datetime
from decimal import Decimal
import uuid as uuid_lib
import sys
import re

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

# Configuration
account_number = "GE78BG0000000893486000"
raw_table_name = "bog_gel_raw_893486000"

# Get account UUID and currency
cursor.execute("""
    SELECT uuid, currency_uuid 
    FROM bank_accounts 
    WHERE account_number = %s
""", (account_number,))
account_info = cursor.fetchone()

if not account_info:
    print(f"❌ Account {account_number} not found!")
    sys.exit(1)

account_uuid = account_info['uuid']
account_currency_uuid = account_info['currency_uuid']

print(f"✅ Account UUID: {account_uuid}")
print(f"📋 Processing from: {raw_table_name}")

# Load counteragents map
print("📋 Loading counteragents...")
cursor.execute("SELECT counteragent_uuid, identification_number FROM counteragents WHERE identification_number IS NOT NULL")
counteragents_map = {row['identification_number']: row['counteragent_uuid'] for row in cursor.fetchall()}
print(f"✅ Loaded {len(counteragents_map)} counteragents")

# Load payments map by payment_id
print("💳 Loading payments...")
cursor.execute("""
    SELECT record_uuid, payment_id, counteragent_uuid, project_uuid, 
           financial_code_uuid, currency_uuid 
    FROM payments 
    WHERE payment_id IS NOT NULL
""")
payments_map = {}
for row in cursor.fetchall():
    payments_map[row['payment_id']] = {
        'payment_uuid': row['record_uuid'],
        'counteragent_uuid': row['counteragent_uuid'],
        'project_uuid': row['project_uuid'],
        'financial_code_uuid': row['financial_code_uuid'],
        'currency_uuid': row['currency_uuid']
    }
print(f"✅ Loaded {len(payments_map)} payments")

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

# Get unprocessed records from raw table
print(f"\n🔄 Fetching unprocessed records from {raw_table_name}...")
cursor.execute(f"""
    SELECT uuid as raw_uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
           EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
           DocSenderAcctNo, DocBenefAcctNo, DocNomination, DocInformation
    FROM {raw_table_name}
    WHERE is_processed = false
    ORDER BY DocRecDate, DocKey, EntriesId
""")

unprocessed_records = cursor.fetchall()
print(f"📦 Found {len(unprocessed_records)} unprocessed records")

if not unprocessed_records:
    print("✅ No unprocessed records to process!")
    cursor.close()
    conn.close()
    sys.exit(0)

# Process records
transactions_to_insert = []
skipped_pending = 0
skipped_duplicates = 0
missing_counteragents = []
payment_counteragent_mismatches = []

for record in unprocessed_records:
    raw_uuid = record['raw_uuid']
    DocKey = record['dockey']
    EntriesId = record['entriesid']
    DocRecDate = record['docrecdate']
    DocValueDate = record['docvaluedate']
    EntryCrAmt = record['entrycramt']
    EntryDbAmt = record['entrydbamt']
    DocSenderInn = record['docsenderinn']
    DocBenefInn = record['docbenefinn']
    DocSenderAcctNo = record['docsenderacctno']
    DocBenefAcctNo = record['docbenefacctno']
    DocNomination = record['docnomination']
    DocInformation = record['docinformation']
    
    # Check for duplicates using id_1 + id_2 combination
    cursor.execute("""
        SELECT uuid FROM consolidated_bank_accounts 
        WHERE id_1 = %s AND id_2 = %s
    """, (DocKey, EntriesId))
    
    if cursor.fetchone():
        skipped_duplicates += 1
        continue
    
    # Generate record_uuid from DocKey+EntriesId
    record_uuid_str = f"{DocKey}_{EntriesId}"
    record_uuid = str(uuid_lib.uuid5(uuid_lib.NAMESPACE_DNS, record_uuid_str))
    
    # Extract amounts
    credit = Decimal(EntryCrAmt) if EntryCrAmt else Decimal('0')
    debit = Decimal(EntryDbAmt) if EntryDbAmt else Decimal('0')
    
    # Calculate account_currency_amount (credit positive, debit negative)
    account_currency_amount = credit - debit
    
    # Parse dates (format: DD.MM.YYYY or DD.MM.YY)
    def parse_bog_date(date_str):
        if not date_str:
            return None
        try:
            # Try DD.MM.YYYY first
            return datetime.strptime(date_str, '%d.%m.%Y').date()
        except ValueError:
            try:
                # Try DD.MM.YY
                return datetime.strptime(date_str, '%d.%m.%y').date()
            except ValueError:
                return None
    
    transaction_date = parse_bog_date(DocValueDate)
    correction_date = parse_bog_date(DocRecDate)
    
    # Skip transactions without a valid date
    if not transaction_date:
        skipped_pending += 1
        continue
    
    # Determine transaction direction and extract counteragent info
    is_credit = credit > 0
    
    if is_credit:
        # Income: counteragent is sender
        counteragent_inn = DocSenderInn.strip() if DocSenderInn else None
        counteragent_account_number = DocSenderAcctNo
    else:
        # Expense: counteragent is beneficiary
        counteragent_inn = DocBenefInn.strip() if DocBenefInn else None
        counteragent_account_number = DocBenefAcctNo
    
    # Match counteragent by INN
    counteragent_uuid = counteragents_map.get(counteragent_inn) if counteragent_inn else None
    
    if not counteragent_uuid and counteragent_inn:
        missing_counteragents.append({
            'inn': counteragent_inn,
            'doc_key': DocKey,
            'date': DocValueDate
        })
    
    # Extract description
    description = DocNomination
    
    # Match payment_id from DocInformation
    doc_info_text = DocInformation.strip() if DocInformation else None
    
    payment_uuid = None
    project_uuid = None
    financial_code_uuid = None
    nominal_currency_uuid = None
    
    if doc_info_text and doc_info_text in payments_map:
        payment_data = payments_map[doc_info_text]
        payment_uuid = payment_data['payment_uuid']
        
        # Validate counteragent match (priority to INN)
        if counteragent_uuid and payment_data['counteragent_uuid'] != counteragent_uuid:
            payment_counteragent_mismatches.append({
                'doc_key': DocKey,
                'payment_counteragent': payment_data['counteragent_uuid'],
                'inn_counteragent': counteragent_uuid
            })
            # Clear payment_uuid due to mismatch
            payment_uuid = None
        else:
            # Derive from payment
            project_uuid = payment_data['project_uuid']
            financial_code_uuid = payment_data['financial_code_uuid']
            nominal_currency_uuid = payment_data['currency_uuid']
    
    # Calculate nominal_amount using NBG rates
    nominal_amount = None
    if nominal_currency_uuid:
        # Get currency code for nominal currency
        cursor.execute("SELECT code FROM currencies WHERE uuid = %s", (nominal_currency_uuid,))
        nom_curr_result = cursor.fetchone()
        nominal_currency_code = nom_curr_result['code'] if nom_curr_result else None
        
        if nominal_currency_code == 'GEL':
            # If nominal is GEL, amount stays same with sign
            nominal_amount = account_currency_amount
        elif nominal_currency_code and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
            # Look up rate for the date
            date_key = transaction_date.strftime('%Y-%m-%d')
            if date_key in nbg_rates_map:
                rate = nbg_rates_map[date_key].get(nominal_currency_code)
                
                if rate and rate > 0:
                    # Formula: amount * (1 / rate) - preserve sign
                    nominal_amount = account_currency_amount * (Decimal('1') / rate)
    else:
        # No payment matched: nominal amount equals account currency amount
        nominal_amount = account_currency_amount
    
    transactions_to_insert.append({
        'uuid': record_uuid,
        'raw_uuid': raw_uuid,
        'account_uuid': account_uuid,
        'account_currency_uuid': account_currency_uuid,
        'account_currency_amount': account_currency_amount,
        'payment_uuid': payment_uuid,
        'counteragent_uuid': counteragent_uuid,
        'project_uuid': project_uuid,
        'financial_code_uuid': financial_code_uuid,
        'nominal_currency_uuid': nominal_currency_uuid,
        'nominal_amount': nominal_amount,
        'date': transaction_date,
        'correction_date': correction_date,
        'id_1': DocKey,
        'id_2': EntriesId,
        'record_uuid': record_uuid_str,
        'counteragent_account_number': counteragent_account_number,
        'description': description
    })

print(f"\n📊 Processing Results:")
print(f"  ✅ Valid transactions: {len(transactions_to_insert)}")
print(f"  ⏭️  Skipped pending: {skipped_pending}")
print(f"  🔄 Skipped duplicates: {skipped_duplicates}")

if missing_counteragents:
    print(f"\n⚠️  Missing counteragents: {len(missing_counteragents)}")
    unique_inns = list(set(item['inn'] for item in missing_counteragents))
    print(f"   Unique missing INNs: {len(unique_inns)}")
    print("   First 5 missing INNs:")
    for inn in unique_inns[:5]:
        print(f"     - {inn}")

if payment_counteragent_mismatches:
    print(f"\n⚠️  Payment-Counteragent mismatches: {len(payment_counteragent_mismatches)}")
    print("   (Payment UUID cleared for these transactions)")

# Insert transactions into consolidated table
if transactions_to_insert:
    print(f"\n💾 Inserting {len(transactions_to_insert)} transactions into consolidated table...")
    
    insert_query = """
        INSERT INTO consolidated_bank_accounts (
            uuid, account_uuid, account_currency_uuid, account_currency_amount,
            payment_uuid, counteragent_uuid, project_uuid, financial_code_uuid,
            nominal_currency_uuid, nominal_amount, date, correction_date,
            id_1, id_2, record_uuid, counteragent_account_number, description
        ) VALUES (
            %(uuid)s, %(account_uuid)s, %(account_currency_uuid)s, %(account_currency_amount)s,
            %(payment_uuid)s, %(counteragent_uuid)s, %(project_uuid)s, %(financial_code_uuid)s,
            %(nominal_currency_uuid)s, %(nominal_amount)s, %(date)s, %(correction_date)s,
            %(id_1)s, %(id_2)s, %(record_uuid)s, %(counteragent_account_number)s, %(description)s
        )
    """
    
    processed_raw_uuids = []
    
    for txn in transactions_to_insert:
        cursor.execute(insert_query, txn)
        processed_raw_uuids.append(txn['raw_uuid'])
    
    # Mark raw records as processed
    for raw_uuid in processed_raw_uuids:
        cursor.execute(f"""
            UPDATE {raw_table_name} 
            SET is_processed = true, updated_at = CURRENT_TIMESTAMP
            WHERE uuid = %s
        """, (raw_uuid,))
    
    print(f"✅ Successfully inserted {len(transactions_to_insert)} transactions!")
    print(f"✅ Marked {len(processed_raw_uuids)} raw records as processed!")
else:
    print("\n⚠️  No new transactions to insert")

cursor.close()
conn.close()

print("\n✅ Processing completed!")
