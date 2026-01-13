import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse
from datetime import datetime
from decimal import Decimal
import uuid as uuid_lib
import sys

# Set UTF-8 encoding for stdout/stderr on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Generate unique batch ID for this import
import_batch_id = str(uuid_lib.uuid4())

# Read REMOTE_DATABASE_URL from .env.local (Supabase connection)
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
cursor = conn.cursor()

# Parse XML file and optional account UUID
if len(sys.argv) < 2:
    print("Usage: python import-bog-statement.py <xml_file_path> [account_uuid]")
    sys.exit(1)

xml_file = sys.argv[1]
provided_account_uuid = sys.argv[2] if len(sys.argv) > 2 else None

print(f"\n📄 Parsing XML file: {xml_file}")
if provided_account_uuid:
    print(f"🔐 Using provided account UUID: {provided_account_uuid}")

tree = ET.parse(xml_file)
root = tree.getroot()

# Extract header information
header = root.find('HEADER')
account_info_text = header.find('AcctNo').text if header.find('AcctNo') is not None else ''
# Extract account number and currency from text like "GE78BG0000000893486000GEL (893486000)"
# Account number is the part before the currency code
account_full = account_info_text.split(' ')[0] if ' ' in account_info_text else account_info_text

# Extract account number (without currency) and currency
if len(account_full) > 3:
    # Last 3 characters are typically currency
    account_number = account_full[:-3]
    currency_code = account_full[-3:]
else:
    print(f"❌ Invalid account format: {account_info_text}")
    sys.exit(1)

print(f"📊 Account: {account_number}")
print(f"💱 Currency: {currency_code}")

# If account UUID was provided, use it directly and get raw_table_name from database
if provided_account_uuid:
    cursor.execute("""
        SELECT ba.uuid, ba.currency_uuid, ba.raw_table_name, ba.account_number, c.code
        FROM bank_accounts ba
        JOIN currencies c ON ba.currency_uuid = c.uuid
        WHERE ba.uuid = %s
    """, (provided_account_uuid,))
    
    account_result = cursor.fetchone()
    if not account_result:
        print(f"❌ Account UUID not found in database: {provided_account_uuid}")
        sys.exit(1)
    
    account_uuid = account_result[0]
    account_currency_uuid = account_result[1]
    raw_table_name = account_result[2]
    db_account_number = account_result[3]
    db_currency_code = account_result[4]
    
    # Verify the account from XML matches the provided UUID
    if db_account_number != account_number or db_currency_code != currency_code:
        print(f"⚠️ Warning: XML account ({account_number} {currency_code}) doesn't match database account ({db_account_number} {db_currency_code})")
        print(f"❌ Account mismatch detected. Aborting import.")
        sys.exit(1)
    
    if not raw_table_name:
        print(f"❌ No raw_table_name configured for account: {account_number}")
        print(f"💡 Please set raw_table_name in bank_accounts table")
        sys.exit(1)
    
    print(f"✅ Account UUID: {account_uuid}")
    print(f"📋 Raw table (from database): {raw_table_name}")
else:
    # Legacy behavior: Lookup account_uuid from bank_accounts
    cursor.execute("""
        SELECT ba.uuid, ba.currency_uuid, ba.raw_table_name
        FROM bank_accounts ba
        JOIN currencies c ON ba.currency_uuid = c.uuid
        WHERE ba.account_number = %s AND c.code = %s
    """, (account_number, currency_code))

    account_result = cursor.fetchone()
    if not account_result:
        print(f"❌ Account not found in database: {account_number} ({currency_code})")
        print("💡 Please create the bank account first in the system")
        sys.exit(1)

    account_uuid = account_result[0]
    account_currency_uuid = account_result[1]
    raw_table_name = account_result[2]
    
    print(f"✅ Account UUID: {account_uuid}")
    
    # Use raw_table_name from database if available, otherwise calculate
    if raw_table_name:
        print(f"📋 Raw table (from database): {raw_table_name}")
    else:
        # Fallback: Determine raw table name based on account number
        # For GE78BG0000000893486000, we want 893486000
        account_suffix = account_number[-9:]  # Last 9 digits
        raw_table_name = f"bog_gel_raw_{account_suffix}"
        print(f"📋 Raw table (calculated): {raw_table_name}")

# Get GEL currency UUID for nominal currency calculations
cursor.execute("SELECT uuid FROM currencies WHERE code = 'GEL'")
gel_currency_result = cursor.fetchone()
gel_currency_uuid = gel_currency_result[0] if gel_currency_result else None

# Get all counteragents for INN matching
cursor.execute("SELECT counteragent_uuid, identification_number FROM counteragents WHERE identification_number IS NOT NULL")
counteragents_map = {row[1].strip(): row[0] for row in cursor.fetchall()}
print(f"📋 Loaded {len(counteragents_map)} counteragents")

# Get all payments for payment_id matching
cursor.execute("""
    SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
    FROM payments 
    WHERE payment_id IS NOT NULL
""")
payments_map = {}
for row in cursor.fetchall():
    payments_map[row[0].strip()] = {
        'payment_id': row[0],
        'counteragent_uuid': row[1],
        'project_uuid': row[2],
        'financial_code_uuid': row[3],
        'currency_uuid': row[4]
    }
print(f"💳 Loaded {len(payments_map)} payments")

# Get NBG exchange rates for currency conversion
cursor.execute("""
    SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
    ORDER BY date
""")
nbg_rates = {}
for row in cursor.fetchall():
    date = row[0]
    nbg_rates[date] = {
        'USD': row[1],
        'EUR': row[2],
        'CNY': row[3],
        'GBP': row[4],
        'RUB': row[5],
        'TRY': row[6],
        'AED': row[7],
        'KZT': row[8]
    }
print(f"📈 Loaded NBG rates for {len(nbg_rates)} dates")

# Parse all transactions
details = root.findall('.//DETAIL')
print(f"\n📦 Found {len(details)} total transactions")

raw_records_to_insert = []
skipped_raw_duplicates = 0
skipped_missing_keys = 0

for detail in details:
    # Extract all fields from XML using exact tag names
    def get_text(tag_name):
        elem = detail.find(tag_name)
        return elem.text if elem is not None and elem.text else None
    
    DocKey = get_text('DocKey')
    EntriesId = get_text('EntriesId')
    
    # MANDATORY: Skip records without DocKey or EntriesId
    if not DocKey or not EntriesId:
        skipped_missing_keys += 1
        continue
    
    # Check for duplicates in raw table
    cursor.execute(f"""
        SELECT uuid FROM {raw_table_name} 
        WHERE DocKey = %s AND EntriesId = %s
    """, (DocKey, EntriesId))
    
    if cursor.fetchone():
        skipped_raw_duplicates += 1
        continue
    
    # Generate UUID for raw record
    record_uuid_str = f"{DocKey}_{EntriesId}"
    record_uuid = str(uuid_lib.uuid5(uuid_lib.NAMESPACE_DNS, record_uuid_str))
    
    raw_records_to_insert.append({
        'uuid': record_uuid,
        'CanCopyDocument': get_text('CanCopyDocument'),
        'CanViewDocument': get_text('CanViewDocument'),
        'CanPrintDocument': get_text('CanPrintDocument'),
        'IsReval': get_text('IsReval'),
        'DocNomination': get_text('DocNomination'),
        'DocInformation': get_text('DocInformation'),
        'DocSrcAmt': get_text('DocSrcAmt'),
        'DocSrcCcy': get_text('DocSrcCcy'),
        'DocDstAmt': get_text('DocDstAmt'),
        'DocDstCcy': get_text('DocDstCcy'),
        'DocKey': DocKey,
        'DocRecDate': get_text('DocRecDate'),
        'DocBranch': get_text('DocBranch'),
        'DocDepartment': get_text('DocDepartment'),
        'DocProdGroup': get_text('DocProdGroup'),
        'DocNo': get_text('DocNo'),
        'DocValueDate': get_text('DocValueDate'),
        'DocSenderName': get_text('DocSenderName'),
        'DocSenderInn': get_text('DocSenderInn'),
        'DocSenderAcctNo': get_text('DocSenderAcctNo'),
        'DocSenderBic': get_text('DocSenderBic'),
        'DocActualDate': get_text('DocActualDate'),
        'DocCorAcct': get_text('DocCorAcct'),
        'DocCorBic': get_text('DocCorBic'),
        'DocCorBankName': get_text('DocCorBankName'),
        'EntriesId': EntriesId,
        'DocComment': get_text('DocComment'),
        'CcyRate': get_text('CcyRate'),
        'EntryPDate': get_text('EntryPDate'),
        'EntryDocNo': get_text('EntryDocNo'),
        'EntryLAcct': get_text('EntryLAcct'),
        'EntryLAcctOld': get_text('EntryLAcctOld'),
        'EntryDbAmt': get_text('EntryDbAmt'),
        'EntryDbAmtBase': get_text('EntryDbAmtBase'),
        'EntryCrAmt': get_text('EntryCrAmt'),
        'EntryCrAmtBase': get_text('EntryCrAmtBase'),
        'OutBalance': get_text('OutBalance'),
        'EntryAmtBase': get_text('EntryAmtBase'),
        'EntryComment': get_text('EntryComment'),
        'EntryDepartment': get_text('EntryDepartment'),
        'EntryAcctPoint': get_text('EntryAcctPoint'),
        'DocSenderBicName': get_text('DocSenderBicName'),
        'DocBenefName': get_text('DocBenefName'),
        'DocBenefInn': get_text('DocBenefInn'),
        'DocBenefAcctNo': get_text('DocBenefAcctNo'),
        'DocBenefBic': get_text('DocBenefBic'),
        'DocBenefBicName': get_text('DocBenefBicName'),
        'DocPayerName': get_text('DocPayerName'),
        'DocPayerInn': get_text('DocPayerInn'),
        'import_batch_id': import_batch_id,
        'is_processed': False
    })

print(f"\n📊 Raw Data Import Results:")
print(f"  ✅ New raw records: {len(raw_records_to_insert)}")
print(f"  🔄 Skipped duplicates: {skipped_raw_duplicates}")
print(f"  ⚠️  Skipped missing keys: {skipped_missing_keys}")

# Insert raw records
if raw_records_to_insert:
    print(f"\n💾 Inserting {len(raw_records_to_insert)} raw records into {raw_table_name}...")
    
    insert_raw_query = f"""
        INSERT INTO {raw_table_name} (
            uuid, CanCopyDocument, CanViewDocument, CanPrintDocument, IsReval,
            DocNomination, DocInformation, DocSrcAmt, DocSrcCcy, DocDstAmt, DocDstCcy,
            DocKey, DocRecDate, DocBranch, DocDepartment, DocProdGroup, DocNo,
            DocValueDate, DocSenderName, DocSenderInn, DocSenderAcctNo, DocSenderBic,
            DocActualDate, DocCorAcct, DocCorBic, DocCorBankName, EntriesId, DocComment,
            CcyRate, EntryPDate, EntryDocNo, EntryLAcct, EntryLAcctOld, EntryDbAmt,
            EntryDbAmtBase, EntryCrAmt, EntryCrAmtBase, OutBalance, EntryAmtBase,
            EntryComment, EntryDepartment, EntryAcctPoint, DocSenderBicName, DocBenefName,
            DocBenefInn, DocBenefAcctNo, DocBenefBic, DocBenefBicName, DocPayerName, DocPayerInn,
            import_batch_id, is_processed
        ) VALUES (
            %(uuid)s, %(CanCopyDocument)s, %(CanViewDocument)s, %(CanPrintDocument)s, %(IsReval)s,
            %(DocNomination)s, %(DocInformation)s, %(DocSrcAmt)s, %(DocSrcCcy)s, %(DocDstAmt)s, %(DocDstCcy)s,
            %(DocKey)s, %(DocRecDate)s, %(DocBranch)s, %(DocDepartment)s, %(DocProdGroup)s, %(DocNo)s,
            %(DocValueDate)s, %(DocSenderName)s, %(DocSenderInn)s, %(DocSenderAcctNo)s, %(DocSenderBic)s,
            %(DocActualDate)s, %(DocCorAcct)s, %(DocCorBic)s, %(DocCorBankName)s, %(EntriesId)s, %(DocComment)s,
            %(CcyRate)s, %(EntryPDate)s, %(EntryDocNo)s, %(EntryLAcct)s, %(EntryLAcctOld)s, %(EntryDbAmt)s,
            %(EntryDbAmtBase)s, %(EntryCrAmt)s, %(EntryCrAmtBase)s, %(OutBalance)s, %(EntryAmtBase)s,
            %(EntryComment)s, %(EntryDepartment)s, %(EntryAcctPoint)s, %(DocSenderBicName)s, %(DocBenefName)s,
            %(DocBenefInn)s, %(DocBenefAcctNo)s, %(DocBenefBic)s, %(DocBenefBicName)s, %(DocPayerName)s, %(DocPayerInn)s,
            %(import_batch_id)s, %(is_processed)s
        )
    """
    
    for rec in raw_records_to_insert:
        cursor.execute(insert_raw_query, rec)
    
    print(f"✅ Successfully inserted {len(raw_records_to_insert)} raw records!")

# Now process raw records to consolidated table
print(f"\n🔄 Processing raw records from {raw_table_name} to consolidated table...")

# Get unprocessed records from this batch
cursor.execute(f"""
    SELECT uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
           EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
           DocSenderAcctNo, DocBenefAcctNo, DocNomination, DocInformation
    FROM {raw_table_name}
    WHERE import_batch_id = %s AND is_processed = false
""", (import_batch_id,))

raw_records = cursor.fetchall()

transactions_to_insert = []
skipped_pending = 0
skipped_duplicates = 0
missing_counteragents = []
payment_counteragent_mismatches = []

for raw_record in raw_records:
    raw_uuid = raw_record[0]
    DocKey = raw_record[1]
    EntriesId = raw_record[2]
    DocRecDate = raw_record[3]
    DocValueDate = raw_record[4]
    EntryCrAmt = raw_record[5]
    EntryDbAmt = raw_record[6]
    DocSenderInn = raw_record[7]
    DocBenefInn = raw_record[8]
    DocSenderAcctNo = raw_record[9]
    DocBenefAcctNo = raw_record[10]
    DocNomination = raw_record[11]
    DocInformation = raw_record[12]
    
    # Skip pending transactions (Note #2)
    if not DocKey or not EntriesId:
        skipped_pending += 1
        continue
    
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
    
    # Extract dates
    date_str = DocValueDate
    correction_date_str = DocRecDate
    
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
    
    transaction_date = parse_bog_date(date_str)
    correction_date = parse_bog_date(correction_date_str)
    
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
            'date': date_str
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
        payment_uuid = payment_data['payment_id']
        
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
        nominal_currency_code = nom_curr_result[0] if nom_curr_result else None
        
        if nominal_currency_code == 'GEL':
            # If nominal is GEL, amount stays same
            nominal_amount = abs(account_currency_amount)
        elif nominal_currency_code and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
            # Look up rate for the date
            rate_date = correction_date if correction_date != transaction_date else transaction_date
            if rate_date in nbg_rates:
                rate = nbg_rates[rate_date].get(nominal_currency_code)
                
                if rate and rate > 0:
                    # Formula: amount * (1 / rate)
                    nominal_amount = abs(account_currency_amount) * (Decimal('1') / rate)
    
    transactions_to_insert.append({
        'uuid': record_uuid,
        'raw_uuid': raw_uuid,  # Store raw record UUID for marking processed
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
    print("   First 5 missing INNs:")
    for item in missing_counteragents[:5]:
        print(f"     - INN: {item['inn']} (DocKey: {item['doc_key']}, Date: {item['date']})")

if payment_counteragent_mismatches:
    print(f"\n⚠️  Payment-Counteragent mismatches: {len(payment_counteragent_mismatches)}")
    print("   (Payment_id cleared for these transactions)")

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
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    
    processed_raw_uuids = []
    
    for txn in transactions_to_insert:
        cursor.execute(insert_query, (
            txn['uuid'],
            txn['account_uuid'],
            txn['account_currency_uuid'],
            txn['account_currency_amount'],
            txn['payment_uuid'],
            txn['counteragent_uuid'],
            txn['project_uuid'],
            txn['financial_code_uuid'],
            txn['nominal_currency_uuid'],
            txn['nominal_amount'],
            txn['date'],
            txn['correction_date'],
            txn['id_1'],
            txn['id_2'],
            txn['record_uuid'],
            txn['counteragent_account_number'],
            txn['description']
        ))
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

print("\n✅ Import completed!")
