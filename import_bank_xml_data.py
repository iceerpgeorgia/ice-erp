"""
Bank XML Import Orchestrator - Comprehensive Three-Phase Processing
This script consolidates all XML import and processing logic:
1. Identifies bank account and parsing scheme
2. Parses XML and inserts raw data
3. Three-phase processing: Counteragent → Parsing Rules → Payment ID
"""

import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from urllib.parse import urlparse
import sys
import os
import uuid as uuid_lib
from datetime import datetime
from decimal import Decimal
import re
import time

# Set UTF-8 encoding for stdout/stderr on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Generate unique batch ID for this import
import_batch_id = str(uuid_lib.uuid4())

def log_step(step_num, title, start_time=None):
    """Log a processing step with timing"""
    if start_time:
        elapsed = time.time() - start_time
        print(f"\n{'='*80}")
        print(f"✅ STEP {step_num}: {title} - Completed in {elapsed:.2f}s")
        print(f"{'='*80}\n")
    else:
        print(f"\n{'='*80}")
        print(f"🔄 STEP {step_num}: {title}")
        print(f"{'='*80}\n")
        return time.time()

def compute_case_description(case1, case2, case3, case4, case5, case6, case7, case8):
    """
    Compute case description based on 8-case flags.
    Returns a string describing which case(s) apply to this record.
    """
    cases = []
    
    # Phase 1: Counteragent (mutually exclusive)
    if case1:
        cases.append("Case1 - counteragent identified by INN")
    elif case2:
        cases.append("Case2 - no INN in raw data")
    elif case3:
        cases.append("Case3 - INN exists but no counteragent match")
    
    # Phase 2: Payment ID
    if case4:
        cases.append("Case4 - payment ID matched")
    elif case5:
        cases.append("Case5 - payment ID conflict (counteragent kept)")
    
    # Phase 3: Parsing Rules
    if case6:
        cases.append("Case6 - parsing rule applied")
    elif case7:
        cases.append("Case7 - parsing rule conflict (counteragent kept)")
    
    if case8:
        cases.append("Case8 - rule dominance (overrides payment)")
    
    return "\n".join(cases) if cases else "No case matched"

def get_db_connections():
    """Get Supabase (remote) and Local database connections from .env.local"""
    remote_db_url = None
    local_db_url = None
    
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('REMOTE_DATABASE_URL='):
                    remote_db_url = line.split('=', 1)[1].strip('"').strip("'")
                elif line.startswith('DATABASE_URL='):
                    local_db_url = line.split('=', 1)[1].strip('"').strip("'")
    except Exception as e:
        print(f"❌ Error reading .env.local: {e}")
        sys.exit(1)

    if not remote_db_url:
        raise ValueError("REMOTE_DATABASE_URL not found in .env.local")
    if not local_db_url:
        raise ValueError("DATABASE_URL not found in .env.local")

    # Parse and clean connection strings
    parsed_remote = urlparse(remote_db_url)
    clean_remote_url = f"{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}"
    
    parsed_local = urlparse(local_db_url)
    clean_local_url = f"{parsed_local.scheme}://{parsed_local.netloc}{parsed_local.path}"
    
    print("🔍 Connecting to databases...")
    remote_conn = psycopg2.connect(clean_remote_url)
    remote_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    local_conn = psycopg2.connect(clean_local_url)
    local_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    print("✅ Connected to Supabase (remote) and Local PostgreSQL")
    return remote_conn, local_conn

def identify_bog_gel_account(xml_file):
    """Extract account information from BOG GEL XML format"""
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        header = root.find('HEADER')
        if header is None:
            return None
        
        account_info_text = header.find('AcctNo').text if header.find('AcctNo') is not None else ''
        
        # Extract account number and currency from text like "GE78BG0000000893486000GEL (893486000)"
        account_full = account_info_text.split(' ')[0] if ' ' in account_info_text else account_info_text
        
        if len(account_full) > 3:
            # Last 3 characters are typically currency
            account_number = account_full[:-3]
            currency_code = account_full[-3:]
            return account_number, currency_code, root  # Return root for later use
        
        return None
    except Exception as e:
        print(f"⚠️ Could not parse as BOG GEL format: {e}")
        return None

def parse_bog_date(date_str):
    """Parse BOG date format (DD.MM.YYYY or DD.MM.YY)"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%d.%m.%Y').date()
    except ValueError:
        try:
            return datetime.strptime(date_str, '%d.%m.%y').date()
        except ValueError:
            return None

def normalize_inn(inn):
    """Normalize INN: if 10 digits, prepend '0' to make it 11"""
    if not inn:
        return None
    inn = inn.strip()
    if len(inn) == 10 and inn.isdigit():
        return '0' + inn
    return inn

def extract_payment_id(doc_information):
    """Extract payment_id from DocInformation field with multiple pattern strategies"""
    if not doc_information:
        return None
    
    text = str(doc_information).strip()
    
    # Strategy 1: Look for explicit "payment_id: 12345" or "payment id: 12345"
    match = re.search(r'payment[_\s]*id[:\s]*(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 2: Look for "ID: 12345" or "id: 12345" at start of string
    match = re.search(r'^id[:\s]+(\w+)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Strategy 3: Look for patterns like "#12345" or "№12345"
    match = re.search(r'[#№](\w+)', text)
    if match:
        return match.group(1)
    
    # Strategy 4: If entire text is alphanumeric and reasonable length (5-20 chars), treat as payment_id
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 20:
        return text
    
    return None

def process_bog_gel(xml_file, account_uuid, account_number, currency_code, raw_table_name, 
                   remote_conn, local_conn):
    """
    Process BOG GEL XML file with three-phase hierarchy:
    Phase 1: Counteragent identification
    Phase 2: Parsing rules application
    Phase 3: Payment ID matching
    """
    
    remote_cursor = remote_conn.cursor()
    local_cursor = local_conn.cursor()
    
    print(f"\n{'='*80}")
    print(f"🚀 BOG GEL PROCESSING - Three-Phase Hierarchy")
    print(f"{'='*80}\n")
    
    # Get account details from local database
    local_cursor.execute("""
        SELECT uuid, currency_uuid FROM bank_accounts 
        WHERE uuid = %s
    """, (account_uuid,))
    
    account_result = local_cursor.fetchone()
    if not account_result:
        print(f"❌ Account UUID not found: {account_uuid}")
        sys.exit(1)
    
    bank_account_uuid = account_result[0]
    account_currency_uuid = account_result[1]
    
    print(f"📊 Bank Account UUID: {bank_account_uuid}")
    print(f"💱 Account Currency UUID: {account_currency_uuid}\n")
    
    # ===================
    # STEP 1: Parse XML and Insert Raw Data
    # ===================
    print(f"📄 STEP 1: Parsing XML and inserting raw data...")
    
    result = identify_bog_gel_account(xml_file)
    if not result:
        print("❌ Failed to parse XML")
        sys.exit(1)
    
    _, _, root = result
    details = root.findall('.//DETAIL')
    print(f"📦 Found {len(details)} transactions in XML\n")
    
    raw_records_to_insert = []
    skipped_raw_duplicates = 0
    skipped_missing_keys = 0
    
    for detail in details:
        def get_text(tag_name):
            elem = detail.find(tag_name)
            return elem.text if elem is not None and elem.text else None
        
        DocKey = get_text('DocKey')
        EntriesId = get_text('EntriesId')
        
        if not DocKey or not EntriesId:
            skipped_missing_keys += 1
            continue
        
        # Check for duplicates
        remote_cursor.execute(f"""
            SELECT uuid FROM {raw_table_name} 
            WHERE DocKey = %s AND EntriesId = %s
        """, (DocKey, EntriesId))
        
        if remote_cursor.fetchone():
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
            'counteragent_processed': False,
            'parsing_rule_processed': False,
            'payment_id_processed': False,
            'is_processed': False
        })
    
    print(f"📊 Raw Data Import Results:")
    print(f"  ✅ New records to insert: {len(raw_records_to_insert)}")
    print(f"  🔄 Skipped duplicates: {skipped_raw_duplicates}")
    print(f"  ⚠️  Skipped missing keys: {skipped_missing_keys}\n")
    
    # Insert raw records
    if raw_records_to_insert:
        print(f"💾 Inserting {len(raw_records_to_insert)} raw records...")
        
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
                import_batch_id, counteragent_processed, parsing_rule_processed, payment_id_processed, is_processed
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
                %(import_batch_id)s, %(counteragent_processed)s, %(parsing_rule_processed)s, %(payment_id_processed)s, %(is_processed)s
            )
        """
        
        for rec in raw_records_to_insert:
            remote_cursor.execute(insert_raw_query, rec)
        
        print(f"✅ Successfully inserted {len(raw_records_to_insert)} raw records!\n")
    else:
        print("⚠️ No new records to insert\n")
        return
    
    # ===================
    # STEP 2: Load Dictionaries
    # ===================
    step_start = log_step(2, "LOADING DICTIONARIES")
    
    # Load counteragents
    dict_start = time.time()
    local_cursor.execute("""
        SELECT counteragent_uuid, identification_number, counteragent 
        FROM counteragents 
        WHERE identification_number IS NOT NULL
    """)
    counteragents_map = {}
    for row in local_cursor.fetchall():
        inn = normalize_inn(row[1])
        if inn:
            counteragents_map[inn] = {
                'uuid': row[0],
                'name': row[2]
            }
    print(f"  ✅ Loaded {len(counteragents_map)} counteragents ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load parsing rules
    dict_start = time.time()
    print(f"  ⏳ Loading parsing rules...")
    sys.stdout.flush()
    local_cursor.execute("""
        SELECT 
            id,
            counteragent_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            column_name,
            condition
        FROM parsing_scheme_rules
    """)
    rows = local_cursor.fetchall()
    print(f"  📊 Fetched {len(rows)} parsing rule records from database")
    sys.stdout.flush()
    parsing_rules = []
    for row in rows:
        parsing_rules.append({
            'id': row[0],
            'counteragent_uuid': row[1],
            'financial_code_uuid': row[2],
            'nominal_currency_uuid': row[3],
            'column_name': row[4],
            'condition': row[5]
        })
    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load payments
    dict_start = time.time()
    local_cursor.execute("""
        SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
        FROM payments 
        WHERE payment_id IS NOT NULL
    """)
    payments_map = {}
    for row in local_cursor.fetchall():
        payment_id = row[0].strip() if row[0] else None
        if payment_id:
            payments_map[payment_id] = {
                'payment_id': payment_id,
                'counteragent_uuid': row[1],
                'project_uuid': row[2],
                'financial_code_uuid': row[3],
                'currency_uuid': row[4]
            }
    print(f"  ✅ Loaded {len(payments_map)} payments ({time.time()-dict_start:.2f}s)")
    
    log_step(2, "LOADING DICTIONARIES", step_start)
    
    # ===================
    # STEP 3: Three-Phase Processing
    # ===================
    step_start = log_step(3, "THREE-PHASE PROCESSING WITH HIERARCHY")
    
    # Get unprocessed records from this batch
    remote_cursor.execute(f"""
        SELECT 
            uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
            EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
            DocSenderAcctNo, DocBenefAcctNo, DocCorAcct,
            DocNomination, DocInformation, DocProdGroup
        FROM {raw_table_name}
        WHERE import_batch_id = %s
        ORDER BY DocValueDate DESC
    """, (import_batch_id,))
    
    raw_records = remote_cursor.fetchall()
    total_records = len(raw_records)
    print(f"📦 Processing {total_records} records...\n")
    
    # Statistics for 8-case hierarchical logic
    stats = {
        'case1_counteragent_processed': 0,
        'case2_counteragent_inn_blank': 0,
        'case3_counteragent_inn_nonblank_no_match': 0,
        'case4_payment_id_match': 0,
        'case5_payment_id_counteragent_mismatch': 0,
        'case6_parsing_rule_match': 0,
        'case7_parsing_rule_counteragent_mismatch': 0,
        'case8_parsing_rule_dominance': 0,
    }
    
    missing_counteragents = {}
    consolidated_records = []
    raw_updates = []
    
    for idx, raw_record in enumerate(raw_records, 1):
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
        DocCorAcct = raw_record[11]
        DocNomination = raw_record[12]
        DocInformation = raw_record[13]
        DocProdGroup = raw_record[14]
        
        # Calculate amounts
        credit = Decimal(EntryCrAmt) if EntryCrAmt else Decimal('0')
        debit = Decimal(EntryDbAmt) if EntryDbAmt else Decimal('0')
        account_currency_amount = credit - debit
        
        # Parse dates
        transaction_date = parse_bog_date(DocValueDate)
        correction_date = parse_bog_date(DocRecDate)
        
        if not transaction_date:
            continue
        
        # Initialize processing flags and data
        counteragent_uuid = None
        counteragent_inn = None
        counteragent_account_number = None
        project_uuid = None
        financial_code_uuid = None
        nominal_currency_uuid = account_currency_uuid
        nominal_amount = account_currency_amount
        payment_id = None
        
        # Initialize 8-case flags (Cases 1/2/3 are mutually exclusive)
        case1_counteragent_processed = False
        case2_counteragent_inn_blank = False
        case3_counteragent_inn_nonblank_no_match = False
        case4_payment_id_match = False
        case5_payment_id_counteragent_mismatch = False
        case6_parsing_rule_match = False
        case7_parsing_rule_counteragent_mismatch = False
        case8_parsing_rule_dominance = False
        
        # =============================
        # PHASE 1: Counteragent Identification
        # =============================
        
        # PRIORITY 1: Use DocCorAcct if available (correspondent account from bank statement)
        counteragent_account_number = None
        if DocCorAcct and str(DocCorAcct).strip():
            counteragent_account_number = str(DocCorAcct).strip()
        
        # Determine transaction direction
        is_incoming = (debit is None or debit == 0)
        
        # Extract INN based on direction
        if is_incoming:
            # Incoming payment - counteragent is the sender
            counteragent_inn = normalize_inn(DocSenderInn)
            # FALLBACK: Use DocSenderAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocSenderAcctNo and str(DocSenderAcctNo).strip():
                counteragent_account_number = str(DocSenderAcctNo).strip()
        else:
            # Outgoing payment - counteragent is the beneficiary
            counteragent_inn = normalize_inn(DocBenefInn)
            # FALLBACK: Use DocBenefAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocBenefAcctNo and str(DocBenefAcctNo).strip():
                counteragent_account_number = str(DocBenefAcctNo).strip()
        
        # Process Cases 1, 2, 3 (mutually exclusive)
        if counteragent_inn:
            counteragent_data = counteragents_map.get(counteragent_inn)
            if counteragent_data:
                # CASE 1: Counteragent matched by INN
                counteragent_uuid = counteragent_data['uuid']
                case1_counteragent_processed = True
                stats['case1_counteragent_processed'] += 1
                
                if idx <= 3:
                    print(f"  ✅ [CASE 1] Record {DocKey}_{EntriesId}: Matched counteragent {counteragent_data['name']}")
            else:
                # CASE 3: INN exists but no match in database
                case3_counteragent_inn_nonblank_no_match = True
                stats['case3_counteragent_inn_nonblank_no_match'] += 1
                
                if counteragent_inn not in missing_counteragents:
                    missing_counteragents[counteragent_inn] = {
                        'inn': counteragent_inn,
                        'count': 0,
                        'samples': []
                    }
                missing_counteragents[counteragent_inn]['count'] += 1
                if len(missing_counteragents[counteragent_inn]['samples']) < 3:
                    missing_counteragents[counteragent_inn]['samples'].append(f"{DocKey}_{EntriesId}")
                
                if idx <= 3:
                    print(f"  ⚠️  [CASE 2] Record {DocKey}_{EntriesId}: INN {counteragent_inn} needs counteragent")
        else:
            # CASE 2: INN is blank
            case2_counteragent_inn_blank = True
            stats['case2_counteragent_inn_blank'] += 1
            
            if idx <= 3:
                print(f"  ℹ️  [CASE 3] Record {DocKey}_{EntriesId}: INN blank - will try payment/rules")
        
        # =============================
        # PHASE 2: Parsing Rules Application
        # =============================
        
        # Try to match parsing rule
        matched_rule = None
        for rule in parsing_rules:
            # Match by column_name and condition
            column_name = rule.get('column_name', '')
            condition = rule.get('condition', '')
            
            if not column_name or not condition:
                continue
            
            # Dynamically check the raw data field specified in column_name
            # Map database column names to our local variables
            field_map = {
                'DocProdGroup': DocProdGroup,
                'DocNomination': DocNomination,
                'DocInformation': DocInformation,
                'DocKey': DocKey,
            }
            
            field_value = field_map.get(column_name)
            if field_value and str(field_value).strip() == str(condition).strip():
                matched_rule = rule
                if idx <= 3:
                    print(f"    🎯 [RULE MATCH] {column_name}='{condition}'")
                break
        
        if matched_rule:
            # Check if rule provides a payment_id
            rule_payment_id = matched_rule.get('payment_id')
            rule_payment_data = None
            if rule_payment_id and rule_payment_id in payments_map:
                rule_payment_data = payments_map[rule_payment_id]
                if idx <= 3:
                    print(f"    🎯 [RULE->PAYMENT] Rule provides payment_id: {rule_payment_id}")
            
            # Phase 2 can ONLY set counteragent if Phase 1 didn't find one
            # Check rule's direct counteragent first, then rule's payment
            rule_counteragent = matched_rule['counteragent_uuid']
            if not rule_counteragent and rule_payment_data:
                rule_counteragent = rule_payment_data['counteragent_uuid']
            
            if counteragent_uuid:
                # Phase 1 found counteragent - check for conflict but DON'T override
                if rule_counteragent and rule_counteragent != counteragent_uuid:
                    case7_parsing_rule_counteragent_mismatch = True
                    parsing_rule_conflict = True
                    stats['case7_parsing_rule_counteragent_mismatch'] += 1
                    
                    if idx <= 3:
                        print(f"    ⚠️  [CONFLICT] Parsing rule suggests different counteragent - keeping Phase 1 counteragent")
            else:
                # Phase 1 didn't find counteragent - Phase 2 can set it
                if rule_counteragent:
                    counteragent_uuid = rule_counteragent
            
            # Phase 2 ALWAYS sets other parameters (will override Phase 3 if it runs later)
            # Priority: rule's direct params > rule's payment params
            if matched_rule['financial_code_uuid']:
                financial_code_uuid = matched_rule['financial_code_uuid']
            elif rule_payment_data and rule_payment_data.get('financial_code_uuid'):
                financial_code_uuid = rule_payment_data['financial_code_uuid']
            
            if matched_rule['nominal_currency_uuid']:
                nominal_currency_uuid = matched_rule['nominal_currency_uuid']
            elif rule_payment_data and rule_payment_data.get('currency_uuid'):
                nominal_currency_uuid = rule_payment_data['currency_uuid']
            elif not nominal_currency_uuid:
                nominal_currency_uuid = account_currency_uuid
            
            if rule_payment_data and rule_payment_data.get('project_uuid'):
                project_uuid = rule_payment_data['project_uuid']
            
            # Set case6 flag only if no conflict (case7 not set)
            if not case7_parsing_rule_counteragent_mismatch:
                case6_parsing_rule_match = True
            parsing_rule_processed = True
            stats['case6_parsing_rule_match'] += 1
            
            if idx <= 3:
                print(f"    ✅ [RULE] Applied parsing rule parameters")
        else:
            parsing_rule_processed = False
        
        # =============================
        # PHASE 3: Payment ID Matching
        # =============================
        
        # Extract payment_id from DocInformation
        extracted_payment_id = extract_payment_id(DocInformation)
        
        if extracted_payment_id and extracted_payment_id in payments_map:
            payment_data = payments_map[extracted_payment_id]
            payment_counteragent = payment_data['counteragent_uuid']
            
            # Phase 3 can ONLY set counteragent if Phase 1 didn't find one
            if counteragent_uuid:
                # Phase 1 found counteragent - check for conflict but DON'T override
                if payment_counteragent and payment_counteragent != counteragent_uuid:
                    payment_conflict = True
                    stats['case5_payment_id_counteragent_mismatch'] += 1
                    
                    if idx <= 3:
                        print(f"    ⚠️  [CONFLICT] Payment suggests different counteragent - keeping Phase 1 counteragent")
            else:
                # Phase 1 didn't find counteragent - Phase 3 can set it
                if payment_counteragent:
                    counteragent_uuid = payment_counteragent
            
            payment_id = extracted_payment_id
            
            # Phase 3 can ONLY set parameters if Phase 2 didn't set them (Phase 2 has priority)
            # Check if Phase 2 (parsing rule) already set these - if so, it's Case 8 (rule dominance)
            rule_dominated = False
            if parsing_rule_processed:
                # Check if rule set any parameters that override payment
                if (financial_code_uuid and payment_data.get('financial_code_uuid') and 
                    financial_code_uuid != payment_data['financial_code_uuid']):
                    rule_dominated = True
                if (project_uuid and payment_data.get('project_uuid') and 
                    project_uuid != payment_data['project_uuid']):
                    rule_dominated = True
                if (nominal_currency_uuid and nominal_currency_uuid != account_currency_uuid and
                    payment_data.get('currency_uuid') and 
                    nominal_currency_uuid != payment_data['currency_uuid']):
                    rule_dominated = True
            
            if rule_dominated:
                case8_parsing_rule_dominance = True
                stats['case8_parsing_rule_dominance'] += 1
                if idx <= 3:
                    print(f"    🔄 [DOMINANCE] Parsing rule overrides payment parameters")
            
            # Apply payment parameters only if not already set by Phase 2
            if not project_uuid and payment_data['project_uuid']:
                project_uuid = payment_data['project_uuid']
            if not financial_code_uuid and payment_data['financial_code_uuid']:
                financial_code_uuid = payment_data['financial_code_uuid']
            if (not nominal_currency_uuid or nominal_currency_uuid == account_currency_uuid) and payment_data['currency_uuid']:
                nominal_currency_uuid = payment_data['currency_uuid']
            
            # Set case4 flag only if no conflict (case5 not set) and no dominance (case8 not set)
            if not case5_payment_id_counteragent_mismatch and not case8_parsing_rule_dominance:
                case4_payment_id_match = True
            payment_id_processed = True
            stats['case4_payment_id_match'] += 1
            
            if idx <= 3:
                print(f"    ✅ [PAYMENT] Matched payment_id {payment_id}")
        else:
            payment_id_processed = False
        
        # Check if fully processed (tracked by 8 individual case flags)
        is_fully_processed = True
        
        # Compute case description from 8 flags
        case_description = compute_case_description(
            case1_counteragent_processed,
            case2_counteragent_inn_blank,
            case3_counteragent_inn_nonblank_no_match,
            case4_payment_id_match,
            case5_payment_id_counteragent_mismatch,
            case6_parsing_rule_match,
            case7_parsing_rule_counteragent_mismatch,
            case8_parsing_rule_dominance
        )
        
        # Prepare consolidated record
        consolidated_uuid = str(uuid_lib.uuid4())
        consolidated_records.append({
            'uuid': consolidated_uuid,
            'bank_account_uuid': bank_account_uuid,
            'raw_record_uuid': raw_uuid,
            'transaction_date': transaction_date,
            'description': DocNomination or '',
            'counteragent_uuid': counteragent_uuid,
            'counteragent_account_number': counteragent_account_number,
            'project_uuid': project_uuid,
            'financial_code_uuid': financial_code_uuid,
            'account_currency_uuid': account_currency_uuid,
            'account_currency_amount': float(account_currency_amount),
            'nominal_currency_uuid': nominal_currency_uuid,
            'nominal_amount': float(nominal_amount),
            'processing_case': case_description
        })
        
        # Prepare raw table update
        raw_updates.append({
            'uuid': raw_uuid,
            'case1_counteragent_processed': case1_counteragent_processed,
            'case2_counteragent_inn_blank': case2_counteragent_inn_blank,
            'case3_counteragent_inn_nonblank_no_match': case3_counteragent_inn_nonblank_no_match,
            'case4_payment_id_match': case4_payment_id_match,
            'case5_payment_id_counteragent_mismatch': case5_payment_id_counteragent_mismatch,
            'case6_parsing_rule_match': case6_parsing_rule_match,
            'case7_parsing_rule_counteragent_mismatch': case7_parsing_rule_counteragent_mismatch,
            'case8_parsing_rule_dominance': case8_parsing_rule_dominance
        })
        
        # Progress reporting with timing
        if idx % 1000 == 0 or idx == total_records:
            elapsed = time.time() - step_start
            records_per_sec = idx / elapsed if elapsed > 0 else 0
            remaining = (total_records - idx) / records_per_sec if records_per_sec > 0 else 0
            print(f"\r  📊 Progress: {idx}/{total_records} ({idx*100//total_records}%) | {records_per_sec:.1f} rec/s | ETA: {remaining:.1f}s", end='', flush=True)
    
    log_step(3, "THREE-PHASE PROCESSING", step_start)
    
    # ===================
    # STEP 4: Insert Consolidated Records
    # ===================
    step_start = log_step(4, f"INSERTING {len(consolidated_records)} CONSOLIDATED RECORDS")
    
    if consolidated_records:
        insert_consolidated_query = """
            INSERT INTO consolidated_bank_accounts (
                uuid, bank_account_uuid, raw_record_uuid, transaction_date,
                description, counteragent_uuid, counteragent_account_number,
                project_uuid, financial_code_uuid,
                account_currency_uuid, account_currency_amount,
                nominal_currency_uuid, nominal_amount,
                processing_case, created_at
            ) VALUES (
                %(uuid)s, %(bank_account_uuid)s, %(raw_record_uuid)s, %(transaction_date)s,
                %(description)s, %(counteragent_uuid)s, %(counteragent_account_number)s,
                %(project_uuid)s, %(financial_code_uuid)s,
                %(account_currency_uuid)s, %(account_currency_amount)s,
                %(nominal_currency_uuid)s, %(nominal_amount)s,
                %(processing_case)s, NOW()
            )
        """
        
        # Batch insert with progress tracking
        print(f"  🚀 Starting batch insert of {len(consolidated_records)} records to SUPABASE...")
        sys.stdout.flush()
        insert_start = time.time()
        
        # Insert in chunks to show progress
        chunk_size = 5000
        total_chunks = (len(consolidated_records) + chunk_size - 1) // chunk_size
        
        for chunk_idx in range(0, len(consolidated_records), chunk_size):
            chunk = consolidated_records[chunk_idx:chunk_idx + chunk_size]
            chunk_num = chunk_idx // chunk_size + 1
            remote_cursor.executemany(insert_consolidated_query, chunk)
            elapsed = time.time() - insert_start
            pct = (chunk_idx + len(chunk)) * 100 // len(consolidated_records)
            print(f"  📊 Insert progress: {chunk_num}/{total_chunks} chunks ({pct}%) - {elapsed:.1f}s elapsed")
            sys.stdout.flush()
        
        print(f"  ⏳ Committing transaction to SUPABASE...")
        sys.stdout.flush()
        remote_conn.commit()
        print(f"  ✅ Insert completed in {time.time()-insert_start:.2f}s")
        
        log_step(4, "CONSOLIDATED RECORDS INSERTION", step_start)
    
    # ===================
    # STEP 5: Update Raw Table Flags
    # ===================
    step_start = log_step(5, f"UPDATING {len(raw_updates)} RAW TABLE FLAGS")
    
    if raw_updates:
        update_raw_query = f"""
            UPDATE {raw_table_name} SET
                counteragent_processed = %(case1_counteragent_processed)s,
                counteragent_inn_blank = %(case2_counteragent_inn_blank)s,
                counteragent_inn_nonblank_no_match = %(case3_counteragent_inn_nonblank_no_match)s,
                payment_id_match = %(case4_payment_id_match)s,
                payment_id_counteragent_mismatch = %(case5_payment_id_counteragent_mismatch)s,
                parsing_rule_match = %(case6_parsing_rule_match)s,
                parsing_rule_counteragent_mismatch = %(case7_parsing_rule_counteragent_mismatch)s,
                parsing_rule_dominance = %(case8_parsing_rule_dominance)s,
                is_processed = TRUE,
                updated_at = NOW()
            WHERE uuid = %(uuid)s
        """
        
        # Batch update with progress tracking
        print(f"  🚀 Starting optimized batch update of {len(raw_updates)} records in SUPABASE...")
        sys.stdout.flush()
        update_start = time.time()
        
        # Create temporary table for bulk update (much faster than executemany)
        print(f"  📄 Creating temporary table...")
        sys.stdout.flush()
        remote_cursor.execute("""
            CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                case1 BOOLEAN,
                case2 BOOLEAN,
                case3 BOOLEAN,
                case4 BOOLEAN,
                case5 BOOLEAN,
                case6 BOOLEAN,
                case7 BOOLEAN,
                case8 BOOLEAN
            )
        """)
        
        # Use COPY for fast bulk insert to temp table
        print(f"  ⬆️ Copying {len(raw_updates)} records to temp table...")
        sys.stdout.flush()
        from io import StringIO
        buffer = StringIO()
        for update in raw_updates:
            buffer.write(f"{update['uuid']}\t{update['case1_counteragent_processed']}\t{update['case2_counteragent_inn_blank']}\t{update['case3_counteragent_inn_nonblank_no_match']}\t{update['case4_payment_id_match']}\t{update['case5_payment_id_counteragent_mismatch']}\t{update['case6_parsing_rule_match']}\t{update['case7_parsing_rule_counteragent_mismatch']}\t{update['case8_parsing_rule_dominance']}\n")
        buffer.seek(0)
        remote_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'case1', 'case2', 'case3', 'case4', 'case5', 'case6', 'case7', 'case8'))
        copy_time = time.time() - update_start
        print(f"  ✅ Temp table loaded in {copy_time:.2f}s")
        sys.stdout.flush()
        
        # Bulk update from temp table (single operation)
        print(f"  🔄 Executing bulk UPDATE FROM temp table...")
        sys.stdout.flush()
        remote_cursor.execute(f"""
            UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.case1,
                counteragent_inn_blank = tmp.case2,
                counteragent_inn_nonblank_no_match = tmp.case3,
                payment_id_match = tmp.case4,
                payment_id_counteragent_mismatch = tmp.case5,
                parsing_rule_match = tmp.case6,
                parsing_rule_counteragent_mismatch = tmp.case7,
                parsing_rule_dominance = tmp.case8,
                is_processed = TRUE,
                updated_at = NOW()
            FROM temp_flag_updates AS tmp
            WHERE raw.uuid = tmp.uuid
        """)
        bulk_time = time.time() - update_start - copy_time
        print(f"  ✅ Bulk update completed in {bulk_time:.2f}s")
        sys.stdout.flush()
        
        print(f"  ⏳ Committing transaction to SUPABASE...")
        sys.stdout.flush()
        remote_conn.commit()
        print(f"  ✅ Update completed in {time.time()-update_start:.2f}s")
        
        log_step(5, "RAW TABLE FLAGS UPDATE", step_start)
    
    # ===================
    # FINAL SUMMARY
    # ===================
    print(f"\n{'='*80}")
    print(f"📊 FINAL SUMMARY")
    print(f"{'='*80}\n")
    
    print(f"📋 Phase 1 - Counteragent Identification:")
    print(f"  ✅ Case 1 (Counteragent matched): {stats['case1_counteragent_processed']}")
    print(f"  ⚠️  Case 3 (INN no match): {stats['case3_counteragent_inn_nonblank_no_match']}")
    print(f"  ℹ️  Case 2 (INN blank): {stats['case2_counteragent_inn_blank']}\n")
    
    print(f"📋 Phase 2 - Parsing Rules:")
    print(f"  ✅ Rules applied: {stats['case6_parsing_rule_match']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['case7_parsing_rule_counteragent_mismatch']}\n")
    
    print(f"📋 Phase 3 - Payment ID:")
    print(f"  ✅ Payment matched: {stats['case4_payment_id_match']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['case5_payment_id_counteragent_mismatch']}\n")
    
    print(f"📊 Overall:")

    print(f"  📦 Total records: {total_records}\n")
    
    if missing_counteragents:
        print(f"⚠️  CASE 2 REPORT - INNs needing counteragents ({len(missing_counteragents)}):")
        print('━' * 80)
        sorted_missing = sorted(missing_counteragents.values(), key=lambda x: x['count'], reverse=True)[:10]
        for data in sorted_missing:
            print(f"  INN: {data['inn']} | Count: {data['count']} | Samples: {', '.join(data['samples'])}")
        if len(missing_counteragents) > 10:
            print(f"  ... and {len(missing_counteragents) - 10} more")
        print('━' * 80)
    
    print(f"\n{'='*80}")
    print(f"✅ Import completed successfully!")
    print(f"{'='*80}\n")

def backparse_existing_data(account_uuid=None, batch_id=None, clear_consolidated=False):
    """
    Backparse existing raw data without importing new XML.
    Applies the same three-phase processing logic to existing records.
    ALL OPERATIONS USE LOCAL DATABASE ONLY.
    """
    
    print(f"\n{'='*80}")
    print(f"🔄 BACKPARSE MODE - Reprocessing Existing Raw Data (LOCAL DB)")
    print(f"{'='*80}\n")
    
    # Connect to LOCAL database only
    print("🔍 Connecting to LOCAL database...")
    _, local_conn = get_db_connections()
    local_cursor = local_conn.cursor()
    print("✅ Connected to LOCAL PostgreSQL\n")
    
    try:
        # Get account information
        if account_uuid:
            print(f"🔍 Looking up account by UUID: {account_uuid}...")
            local_cursor.execute("""
                SELECT 
                    ba.uuid,
                    ba.account_number,
                    c.code as currency_code,
                    ps.scheme as parsing_scheme,
                    ba.raw_table_name,
                    b.bank_name
                FROM bank_accounts ba
                JOIN currencies c ON ba.currency_uuid = c.uuid
                LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
                LEFT JOIN banks b ON ba.bank_uuid = b.uuid
                WHERE ba.uuid = %s
            """, (account_uuid,))
        else:
            print(f"🔍 Looking up all BOG_GEL accounts...")
            local_cursor.execute("""
                SELECT 
                    ba.uuid,
                    ba.account_number,
                    c.code as currency_code,
                    ps.scheme as parsing_scheme,
                    ba.raw_table_name,
                    b.bank_name
                FROM bank_accounts ba
                JOIN currencies c ON ba.currency_uuid = c.uuid
                LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
                LEFT JOIN banks b ON ba.bank_uuid = b.uuid
                WHERE ps.scheme = 'BOG_GEL'
            """)
        
        accounts = local_cursor.fetchall()
        
        if not accounts:
            print(f"❌ No accounts found")
            sys.exit(1)
        
        print(f"✅ Found {len(accounts)} account(s) to process\n")
        
        for account in accounts:
            acc_uuid, acc_number, currency_code, parsing_scheme, raw_table_name, bank_name = account
            
            print(f"\n{'='*80}")
            print(f"📊 Processing Account: {acc_number} ({bank_name})")
            print(f"{'='*80}\n")
            
            if not raw_table_name:
                print(f"⚠️ Skipping - no raw_table_name configured")
                continue
            
            # Optional: Clear existing consolidated records for this account
            if clear_consolidated:
                print(f"🗑️ Clearing existing consolidated records for this account...")
                local_cursor.execute("""
                    DELETE FROM consolidated_bank_accounts 
                    WHERE bank_account_uuid = %s
                """, (acc_uuid,))
                print(f"✅ Cleared consolidated records\n")
            
            # Note: Processing flags (counteragent_processed, etc.) are Supabase-specific
            # LOCAL raw tables only have is_processed flag
            print(f"🔄 Resetting is_processed flags...")
            if batch_id:
                local_cursor.execute(f"""
                    UPDATE {raw_table_name} 
                    SET is_processed = FALSE
                    WHERE import_batch_id = %s
                """, (batch_id,))
            else:
                local_cursor.execute(f"""
                    UPDATE {raw_table_name} 
                    SET is_processed = FALSE
                """)
            local_conn.commit()
            print(f"✅ Processing flags reset\n")
            
            # Now run the three-phase processing on existing data
            # We'll reuse the processing logic but without XML import
            backparse_bog_gel(acc_uuid, acc_number, currency_code, raw_table_name, 
                            local_conn, batch_id)
        
        print(f"\n{'='*80}")
        print(f"✅ Backparse completed successfully!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        local_cursor.close()
        local_conn.close()

def backparse_bog_gel(account_uuid, account_number, currency_code, raw_table_name, 
                     local_conn, batch_id=None):
    """
    Backparse existing BOG GEL raw data (without XML import step)
    Uses the same three-phase processing logic as process_bog_gel
    ALL OPERATIONS ARE LOCAL DATABASE ONLY
    """
    
    local_cursor = local_conn.cursor()
    
    print(f"🚀 BOG GEL BACKPARSE - Three-Phase Hierarchy (LOCAL DB ONLY)")
    
    # Get account details
    local_cursor.execute("""
        SELECT uuid, currency_uuid FROM bank_accounts 
        WHERE uuid = %s
    """, (account_uuid,))
    
    account_result = local_cursor.fetchone()
    if not account_result:
        print(f"❌ Account UUID not found: {account_uuid}")
        return
    
    bank_account_uuid = account_result[0]
    account_currency_uuid = account_result[1]
    
    print(f"📊 Bank Account UUID: {bank_account_uuid}")
    print(f"💱 Account Currency UUID: {account_currency_uuid}\n")
    
    # Skip Step 1 (XML parsing) - data already in raw table
    
    # ===================
    # STEP 2: Load Dictionaries
    # ===================
    step_start = log_step(2, "LOADING DICTIONARIES")
    
    # Load counteragents
    dict_start = time.time()
    local_cursor.execute("""
        SELECT counteragent_uuid, identification_number, counteragent 
        FROM counteragents 
        WHERE identification_number IS NOT NULL
    """)
    counteragents_map = {}
    for row in local_cursor.fetchall():
        inn = normalize_inn(row[1])
        if inn:
            counteragents_map[inn] = {
                'uuid': row[0],
                'name': row[2]
            }
    print(f"  ✅ Loaded {len(counteragents_map)} counteragents ({time.time()-dict_start:.2f}s)")
    
    # Load parsing rules
    dict_start = time.time()
    local_cursor.execute("""
        SELECT 
            id,
            counteragent_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            payment_id,
            column_name,
            condition
        FROM parsing_scheme_rules
    """)
    parsing_rules = []
    for row in local_cursor.fetchall():
        parsing_rules.append({
            'id': row[0],
            'counteragent_uuid': row[1],
            'financial_code_uuid': row[2],
            'nominal_currency_uuid': row[3],
            'payment_id': row[4],
            'column_name': row[5],
            'condition': row[6]
        })
    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules ({time.time()-dict_start:.2f}s)")
    
    # Load payments
    dict_start = time.time()
    local_cursor.execute("""
        SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
        FROM payments 
        WHERE payment_id IS NOT NULL
    """)
    payments_map = {}
    for row in local_cursor.fetchall():
        payment_id = row[0].strip() if row[0] else None
        if payment_id:
            payments_map[payment_id] = {
                'payment_id': payment_id,
                'counteragent_uuid': row[1],
                'project_uuid': row[2],
                'financial_code_uuid': row[3],
                'currency_uuid': row[4]
            }
    print(f"  ✅ Loaded {len(payments_map)} payments ({time.time()-dict_start:.2f}s)")
    
    log_step(2, "LOADING DICTIONARIES", step_start)
    
    # ===================
    # STEP 3: Three-Phase Processing
    # ===================
    step_start = log_step(3, "THREE-PHASE PROCESSING WITH HIERARCHY")
    
    # Get unprocessed records (or all if batch_id specified)
    if batch_id:
        query = f"""
            SELECT 
                uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
                EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
                DocSenderAcctNo, DocBenefAcctNo, DocCorAcct,
                DocNomination, DocInformation, DocProdGroup
            FROM {raw_table_name}
            WHERE import_batch_id = %s
            ORDER BY DocValueDate DESC
        """
        params = (batch_id,)
    else:
        query = f"""
            SELECT 
                uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
                EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
                DocSenderAcctNo, DocBenefAcctNo, DocCorAcct,
                DocNomination, DocInformation, DocProdGroup
            FROM {raw_table_name}
            WHERE DocValueDate IS NOT NULL
            ORDER BY DocValueDate DESC
        """
        params = ()
    
    local_cursor.execute(query, params)
    raw_records = local_cursor.fetchall()
    total_records = len(raw_records)
    print(f"📦 Processing {total_records} records from LOCAL database...\n")
    
    # Statistics for 8 cases
    stats = {
        'case1_counteragent_processed': 0,
        'case2_counteragent_inn_blank': 0,
        'case3_counteragent_inn_nonblank_no_match': 0,
        'case4_payment_id_match': 0,
        'case5_payment_id_counteragent_mismatch': 0,
        'case6_parsing_rule_match': 0,
        'case7_parsing_rule_counteragent_mismatch': 0,
        'case8_parsing_rule_dominance': 0,
    }
    
    missing_counteragents = {}
    consolidated_records = []
    raw_updates = []
    
    # Statistics for 8-case hierarchical logic
    stats = {
        'case1_counteragent_processed': 0,
        'case2_counteragent_inn_blank': 0,
        'case3_counteragent_inn_nonblank_no_match': 0,
        'case4_payment_id_match': 0,
        'case5_payment_id_counteragent_mismatch': 0,
        'case6_parsing_rule_match': 0,
        'case7_parsing_rule_counteragent_mismatch': 0,
        'case8_parsing_rule_dominance': 0,
    }
    
    # Process each record with 8-case hierarchical logic
    for idx, raw_record in enumerate(raw_records, 1):
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
        DocCorAcct = raw_record[11]
        DocNomination = raw_record[12]
        DocInformation = raw_record[13]
        DocProdGroup = raw_record[14]
        
        # Calculate amounts
        credit = Decimal(EntryCrAmt) if EntryCrAmt else Decimal('0')
        debit = Decimal(EntryDbAmt) if EntryDbAmt else Decimal('0')
        account_currency_amount = credit - debit
        
        # Parse dates
        transaction_date = parse_bog_date(DocValueDate)
        correction_date = parse_bog_date(DocRecDate)
        
        if not transaction_date:
            continue
        
        # Initialize processing flags and data
        counteragent_uuid = None
        counteragent_inn = None
        counteragent_account_number = None
        project_uuid = None
        financial_code_uuid = None
        nominal_currency_uuid = account_currency_uuid
        nominal_amount = account_currency_amount
        payment_id = None
        
        # Initialize 8-case flags (Cases 1/2/3 are mutually exclusive)
        case1_counteragent_processed = False
        case2_counteragent_inn_blank = False
        case3_counteragent_inn_nonblank_no_match = False
        case4_payment_id_match = False
        case5_payment_id_counteragent_mismatch = False
        case6_parsing_rule_match = False
        case7_parsing_rule_counteragent_mismatch = False
        case8_parsing_rule_dominance = False
        
        # =============================
        # PHASE 1: Counteragent Identification
        # =============================
        
        # PRIORITY 1: Use DocCorAcct if available (correspondent account from bank statement)
        counteragent_account_number = None
        if DocCorAcct and str(DocCorAcct).strip():
            counteragent_account_number = str(DocCorAcct).strip()
        
        # Determine transaction direction
        is_incoming = (debit is None or debit == 0)
        
        if is_incoming:
            # Incoming payment - counteragent is the sender
            counteragent_inn = normalize_inn(DocSenderInn)
            # FALLBACK: Use DocSenderAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocSenderAcctNo and str(DocSenderAcctNo).strip():
                counteragent_account_number = str(DocSenderAcctNo).strip()
        else:
            # Outgoing payment - counteragent is the beneficiary
            counteragent_inn = normalize_inn(DocBenefInn)
            # FALLBACK: Use DocBenefAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocBenefAcctNo and str(DocBenefAcctNo).strip():
                counteragent_account_number = str(DocBenefAcctNo).strip()
        
        if counteragent_inn:
            counteragent_data = counteragents_map.get(counteragent_inn)
            if counteragent_data:
                counteragent_uuid = counteragent_data['uuid']
                case1_counteragent_processed = True
                stats['case1_counteragent_processed'] += 1
                
                if idx <= 3:
                    print(f"  ✅ [CASE 1] Record {DocKey}_{EntriesId}: Matched counteragent {counteragent_data['name']}")
            else:
                case3_counteragent_inn_nonblank_no_match = True
                counteragent_processed = False
                stats['case3_counteragent_inn_nonblank_no_match'] += 1
                
                if counteragent_inn not in missing_counteragents:
                    missing_counteragents[counteragent_inn] = {
                        'inn': counteragent_inn,
                        'count': 0,
                        'samples': []
                    }
                missing_counteragents[counteragent_inn]['count'] += 1
                if len(missing_counteragents[counteragent_inn]['samples']) < 3:
                    missing_counteragents[counteragent_inn]['samples'].append(f"{DocKey}_{EntriesId}")
                
                if idx <= 3:
                    print(f"  ⚠️  [CASE 3] Record {DocKey}_{EntriesId}: INN {counteragent_inn} needs counteragent")
        else:
            case2_counteragent_inn_blank = True
            counteragent_processed = False
            stats['case2_counteragent_inn_blank'] += 1
            
            if idx <= 3:
                print(f"  ℹ️  [CASE 2] Record {DocKey}_{EntriesId}: No INN - will try rules/payment")
        
        # =============================
        # PHASE 2: Parsing Rules Application
        # =============================
        
        matched_rule = None
        for rule in parsing_rules:
            # Match by column_name and condition
            column_name = rule.get('column_name', '')
            condition = rule.get('condition', '')
            
            if not column_name or not condition:
                continue
            
            # Dynamically check the raw data field specified in column_name
            # Map database column names to our local variables
            field_map = {
                'DocProdGroup': DocProdGroup,
                'DocNomination': DocNomination,
                'DocInformation': DocInformation,
                'DocKey': DocKey,
            }
            
            field_value = field_map.get(column_name)
            if field_value and str(field_value).strip() == str(condition).strip():
                matched_rule = rule
                if idx <= 3:
                    print(f"    🎯 [RULE MATCH] {column_name}='{condition}'")
                break
        
        if matched_rule:
            # Check if rule provides a payment_id
            rule_payment_id = matched_rule.get('payment_id')
            rule_payment_data = None
            if rule_payment_id and rule_payment_id in payments_map:
                rule_payment_data = payments_map[rule_payment_id]
                if idx <= 3:
                    print(f"    🎯 [RULE->PAYMENT] Rule provides payment_id: {rule_payment_id}")
            
            # Phase 2 can ONLY set counteragent if Phase 1 didn't find one
            # Check rule's direct counteragent first, then rule's payment
            rule_counteragent = matched_rule['counteragent_uuid']
            if not rule_counteragent and rule_payment_data:
                rule_counteragent = rule_payment_data['counteragent_uuid']
            
            if counteragent_uuid:
                # Phase 1 found counteragent - check for conflict but DON'T override
                if rule_counteragent and rule_counteragent != counteragent_uuid:
                    case7_parsing_rule_counteragent_mismatch = True
                    parsing_rule_conflict = True
                    stats['case7_parsing_rule_counteragent_mismatch'] += 1
                    
                    if idx <= 3:
                        print(f"    ⚠️  [CONFLICT] Parsing rule suggests different counteragent - keeping Phase 1 counteragent")
            else:
                # Phase 1 didn't find counteragent - Phase 2 can set it
                if rule_counteragent:
                    counteragent_uuid = rule_counteragent
            
            # Phase 2 ALWAYS sets other parameters (will override Phase 3 if it runs later)
            # Priority: rule's direct params > rule's payment params
            if matched_rule['financial_code_uuid']:
                financial_code_uuid = matched_rule['financial_code_uuid']
            elif rule_payment_data and rule_payment_data.get('financial_code_uuid'):
                financial_code_uuid = rule_payment_data['financial_code_uuid']
            
            if matched_rule['nominal_currency_uuid']:
                nominal_currency_uuid = matched_rule['nominal_currency_uuid']
            elif rule_payment_data and rule_payment_data.get('currency_uuid'):
                nominal_currency_uuid = rule_payment_data['currency_uuid']
            elif not nominal_currency_uuid:
                nominal_currency_uuid = account_currency_uuid
            
            if rule_payment_data and rule_payment_data.get('project_uuid'):
                project_uuid = rule_payment_data['project_uuid']
            
            # Set case6 flag only if no conflict (case7 not set)
            if not case7_parsing_rule_counteragent_mismatch:
                case6_parsing_rule_match = True
            parsing_rule_processed = True
            stats['case6_parsing_rule_match'] += 1
            
            if idx <= 3:
                print(f"    ✅ [RULE] Applied parsing rule parameters")
        else:
            parsing_rule_processed = False
        
        # =============================
        # PHASE 3: Payment ID Matching
        # =============================
        
        extracted_payment_id = extract_payment_id(DocInformation)
        
        if extracted_payment_id and extracted_payment_id in payments_map:
            payment_data = payments_map[extracted_payment_id]
            payment_counteragent = payment_data['counteragent_uuid']
            
            # Phase 3 can ONLY set counteragent if Phase 1 didn't find one
            if counteragent_uuid:
                # Phase 1 found counteragent - check for conflict but DON'T override
                if payment_counteragent and payment_counteragent != counteragent_uuid:
                    case5_payment_id_counteragent_mismatch = True
                    payment_conflict = True
                    stats['case5_payment_id_counteragent_mismatch'] += 1
                    
                    if idx <= 3:
                        print(f"    ⚠️  [CONFLICT] Payment suggests different counteragent - keeping Phase 1 counteragent")
            else:
                # Phase 1 didn't find counteragent - Phase 3 can set it
                if payment_counteragent:
                    counteragent_uuid = payment_counteragent
            
            payment_id = extracted_payment_id
            
            # Phase 3 can ONLY set parameters if Phase 2 didn't set them (Phase 2 has priority)
            # Check if Phase 2 (parsing rule) already set these - if so, it's Case 8 (rule dominance)
            rule_dominated = False
            if parsing_rule_processed:
                # Check if rule set any parameters that override payment
                if (financial_code_uuid and payment_data.get('financial_code_uuid') and 
                    financial_code_uuid != payment_data['financial_code_uuid']):
                    rule_dominated = True
                if (project_uuid and payment_data.get('project_uuid') and 
                    project_uuid != payment_data['project_uuid']):
                    rule_dominated = True
                if (nominal_currency_uuid and nominal_currency_uuid != account_currency_uuid and
                    payment_data.get('currency_uuid') and 
                    nominal_currency_uuid != payment_data['currency_uuid']):
                    rule_dominated = True
            
            if rule_dominated:
                case8_parsing_rule_dominance = True
                stats['case8_parsing_rule_dominance'] += 1
                if idx <= 3:
                    print(f"    🔄 [DOMINANCE] Parsing rule overrides payment parameters")
            
            # Apply payment parameters only if not already set by Phase 2
            if not project_uuid and payment_data['project_uuid']:
                project_uuid = payment_data['project_uuid']
            if not financial_code_uuid and payment_data['financial_code_uuid']:
                financial_code_uuid = payment_data['financial_code_uuid']
            if (not nominal_currency_uuid or nominal_currency_uuid == account_currency_uuid) and payment_data['currency_uuid']:
                nominal_currency_uuid = payment_data['currency_uuid']
            
            # Set case4 flag only if no conflict (case5 not set) and no dominance (case8 not set)
            if not case5_payment_id_counteragent_mismatch and not case8_parsing_rule_dominance:
                case4_payment_id_match = True
            payment_id_processed = True
            stats['case4_payment_id_match'] += 1
            
            if idx <= 3:
                print(f"    ✅ [PAYMENT] Matched payment_id {payment_id}")
        else:
            payment_id_processed = False
        
        # All processing tracked by individual 8 case flags
        is_fully_processed = True
        
        # Compute case description from 8 flags
        case_description = compute_case_description(
            case1_counteragent_processed,
            case2_counteragent_inn_blank,
            case3_counteragent_inn_nonblank_no_match,
            case4_payment_id_match,
            case5_payment_id_counteragent_mismatch,
            case6_parsing_rule_match,
            case7_parsing_rule_counteragent_mismatch,
            case8_parsing_rule_dominance
        )
        
        # Prepare consolidated record
        consolidated_uuid = str(uuid_lib.uuid4())
        consolidated_records.append({
            'uuid': consolidated_uuid,
            'bank_account_uuid': bank_account_uuid,
            'raw_record_uuid': raw_uuid,
            'transaction_date': transaction_date,
            'description': DocNomination or '',
            'counteragent_uuid': counteragent_uuid,
            'counteragent_account_number': counteragent_account_number,
            'project_uuid': project_uuid,
            'financial_code_uuid': financial_code_uuid,
            'account_currency_uuid': account_currency_uuid,
            'account_currency_amount': float(account_currency_amount),
            'nominal_currency_uuid': nominal_currency_uuid,
            'nominal_amount': float(nominal_amount),
            'processing_case': case_description
        })
        
        # Prepare raw table update
        raw_updates.append({
            'uuid': raw_uuid,
            'case1_counteragent_processed': case1_counteragent_processed,
            'case2_counteragent_inn_blank': case2_counteragent_inn_blank,
            'case3_counteragent_inn_nonblank_no_match': case3_counteragent_inn_nonblank_no_match,
            'case4_payment_id_match': case4_payment_id_match,
            'case5_payment_id_counteragent_mismatch': case5_payment_id_counteragent_mismatch,
            'case6_parsing_rule_match': case6_parsing_rule_match,
            'case7_parsing_rule_counteragent_mismatch': case7_parsing_rule_counteragent_mismatch,
            'case8_parsing_rule_dominance': case8_parsing_rule_dominance
        })
        
        if idx % 1000 == 0 or idx == total_records:
            elapsed = time.time() - step_start
            records_per_sec = idx / elapsed if elapsed > 0 else 0
            remaining = (total_records - idx) / records_per_sec if records_per_sec > 0 else 0
            print(f"\r  📊 Progress: {idx}/{total_records} ({idx*100//total_records}%) | {records_per_sec:.1f} rec/s | ETA: {remaining:.1f}s", end='', flush=True)
    
    log_step(3, "THREE-PHASE PROCESSING", step_start)
    
    # ===================
    # STEP 4: Insert Consolidated Records
    # ===================
    step_start = log_step(4, f"INSERTING {len(consolidated_records)} CONSOLIDATED RECORDS")
    
    if consolidated_records:
        insert_consolidated_query = """
            INSERT INTO consolidated_bank_accounts (
                uuid, bank_account_uuid, raw_record_uuid, transaction_date,
                description, counteragent_uuid, counteragent_account_number,
                project_uuid, financial_code_uuid,
                account_currency_uuid, account_currency_amount,
                nominal_currency_uuid, nominal_amount,
                processing_case, created_at
            ) VALUES (
                %(uuid)s, %(bank_account_uuid)s, %(raw_record_uuid)s, %(transaction_date)s,
                %(description)s, %(counteragent_uuid)s, %(counteragent_account_number)s,
                %(project_uuid)s, %(financial_code_uuid)s,
                %(account_currency_uuid)s, %(account_currency_amount)s,
                %(nominal_currency_uuid)s, %(nominal_amount)s,
                %(processing_case)s, NOW()
            )
        """
        
        print(f"  🚀 Starting batch insert of {len(consolidated_records)} records to LOCAL database...")
        sys.stdout.flush()
        insert_start = time.time()
        
        # Insert in chunks to show progress
        chunk_size = 5000
        total_chunks = (len(consolidated_records) + chunk_size - 1) // chunk_size
        
        for chunk_idx in range(0, len(consolidated_records), chunk_size):
            chunk = consolidated_records[chunk_idx:chunk_idx + chunk_size]
            chunk_num = chunk_idx // chunk_size + 1
            local_cursor.executemany(insert_consolidated_query, chunk)
            elapsed = time.time() - insert_start
            pct = (chunk_idx + len(chunk)) * 100 // len(consolidated_records)
            print(f"  📊 Insert progress: {chunk_num}/{total_chunks} chunks ({pct}%) - {elapsed:.1f}s elapsed")
            sys.stdout.flush()
        
        print(f"  ⏳ Committing transaction to LOCAL database...")
        sys.stdout.flush()
        local_conn.commit()
        print(f"  ✅ Insert completed in {time.time()-insert_start:.2f}s")
        
        log_step(4, "CONSOLIDATED RECORDS INSERTION", step_start)
    
    # ===================
    # STEP 5: Update Raw Table Flags (LOCAL DB only has is_processed)
    # ===================
    step_start = log_step(5, f"UPDATING {len(raw_updates)} RAW TABLE FLAGS")
    
    if raw_updates:
        update_raw_query = f"""
            UPDATE {raw_table_name} SET
                counteragent_processed = %(case1_counteragent_processed)s,
                counteragent_inn_blank = %(case2_counteragent_inn_blank)s,
                counteragent_inn_nonblank_no_match = %(case3_counteragent_inn_nonblank_no_match)s,
                payment_id_match = %(case4_payment_id_match)s,
                payment_id_counteragent_mismatch = %(case5_payment_id_counteragent_mismatch)s,
                parsing_rule_match = %(case6_parsing_rule_match)s,
                parsing_rule_counteragent_mismatch = %(case7_parsing_rule_counteragent_mismatch)s,
                parsing_rule_dominance = %(case8_parsing_rule_dominance)s,
                is_processed = TRUE,
                updated_at = NOW()
            WHERE uuid = %(uuid)s
        """
        
        print(f"  🚀 Starting optimized batch update of {len(raw_updates)} records in LOCAL database...")
        sys.stdout.flush()
        update_start = time.time()
        
        # Create temporary table for bulk update (much faster than executemany)
        print(f"  📄 Creating temporary table...")
        sys.stdout.flush()
        local_cursor.execute("""
            CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                case1 BOOLEAN,
                case2 BOOLEAN,
                case3 BOOLEAN,
                case4 BOOLEAN,
                case5 BOOLEAN,
                case6 BOOLEAN,
                case7 BOOLEAN,
                case8 BOOLEAN
            )
        """)
        
        # Use COPY for fast bulk insert to temp table
        print(f"  ⬆️ Copying {len(raw_updates)} records to temp table...")
        sys.stdout.flush()
        from io import StringIO
        buffer = StringIO()
        for update in raw_updates:
            buffer.write(f"{update['uuid']}\t{update['case1_counteragent_processed']}\t{update['case2_counteragent_inn_blank']}\t{update['case3_counteragent_inn_nonblank_no_match']}\t{update['case4_payment_id_match']}\t{update['case5_payment_id_counteragent_mismatch']}\t{update['case6_parsing_rule_match']}\t{update['case7_parsing_rule_counteragent_mismatch']}\t{update['case8_parsing_rule_dominance']}\n")
        buffer.seek(0)
        local_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'case1', 'case2', 'case3', 'case4', 'case5', 'case6', 'case7', 'case8'))
        copy_time = time.time() - update_start
        print(f"  ✅ Temp table loaded in {copy_time:.2f}s")
        sys.stdout.flush()
        
        # Bulk update from temp table (single operation)
        print(f"  🔄 Executing bulk UPDATE FROM temp table...")
        sys.stdout.flush()
        local_cursor.execute(f"""
            UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.case1,
                counteragent_inn_blank = tmp.case2,
                counteragent_inn_nonblank_no_match = tmp.case3,
                payment_id_match = tmp.case4,
                payment_id_counteragent_mismatch = tmp.case5,
                parsing_rule_match = tmp.case6,
                parsing_rule_counteragent_mismatch = tmp.case7,
                parsing_rule_dominance = tmp.case8,
                is_processed = TRUE,
                updated_at = NOW()
            FROM temp_flag_updates AS tmp
            WHERE raw.uuid = tmp.uuid
        """)
        bulk_time = time.time() - update_start - copy_time
        print(f"  ✅ Bulk update completed in {bulk_time:.2f}s")
        sys.stdout.flush()
        
        print(f"  ⏳ Committing transaction to LOCAL database...")
        sys.stdout.flush()
        local_conn.commit()
        print(f"  ✅ Update completed in {time.time()-update_start:.2f}s")
        
        log_step(5, "RAW TABLE FLAGS UPDATE", step_start)
    
    # ===================
    # FINAL SUMMARY
    # ===================
    print(f"\n{'='*80}")
    print(f"📊 BACKPARSE SUMMARY - {account_number}")
    print(f"{'='*80}\n")
    
    print(f"📋 Phase 1 - Counteragent Identification:")
    print(f"  ✅ Case 1 (Counteragent matched): {stats['case1_counteragent_processed']}")
    print(f"  ⚠️  Case 3 (INN no match): {stats['case3_counteragent_inn_nonblank_no_match']}")
    print(f"  ℹ️  Case 2 (INN blank): {stats['case2_counteragent_inn_blank']}\n")
    
    print(f"📋 Phase 2 - Parsing Rules:")
    print(f"  ✅ Rules applied: {stats['case6_parsing_rule_match']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['case7_parsing_rule_counteragent_mismatch']}\n")
    
    print(f"📋 Phase 3 - Payment ID:")
    print(f"  ✅ Payment matched: {stats['case4_payment_id_match']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['case5_payment_id_counteragent_mismatch']}\n")
    
    print(f"📊 Overall:")

    print(f"  📦 Total records: {total_records}\n")
    
    if missing_counteragents:
        print(f"⚠️  CASE 2 REPORT - INNs needing counteragents ({len(missing_counteragents)}):")
        print('━' * 80)
        sorted_missing = sorted(missing_counteragents.values(), key=lambda x: x['count'], reverse=True)[:10]
        for data in sorted_missing:
            print(f"  INN: {data['inn']} | Count: {data['count']} | Samples: {', '.join(data['samples'])}")
        if len(missing_counteragents) > 10:
            print(f"  ... and {len(missing_counteragents) - 10} more")
        print('━' * 80)

def main():
    if len(sys.argv) < 2:
        print("\nUsage:")
        print("  Import mode:    python import_bank_xml_data.py import <xml_file_path>")
        print("  Backparse mode: python import_bank_xml_data.py backparse [--account-uuid UUID] [--batch-id ID] [--clear]")
        print("\nExamples:")
        print("  python import_bank_xml_data.py import Statement_206598021.xml")
        print("  python import_bank_xml_data.py backparse")
        print("  python import_bank_xml_data.py backparse --account-uuid 60582948-8c5b-4715-b75c-ca03e3d36a4e")
        print("  python import_bank_xml_data.py backparse --batch-id abc-123 --clear")
        sys.exit(1)

    mode = sys.argv[1].lower()
    
    if mode == 'import':
        # IMPORT MODE: Import new XML file
        if len(sys.argv) < 3:
            print("❌ Error: XML file path required for import mode")
            print("Usage: python import_bank_xml_data.py import <xml_file_path>")
            sys.exit(1)
        
        xml_file = sys.argv[2]
        
        if not os.path.exists(xml_file):
            print(f"❌ File not found: {xml_file}")
            sys.exit(1)

        print(f"\n{'='*80}")
        print(f"📁 IMPORT MODE - Processing XML file: {os.path.basename(xml_file)}")
        print(f"{'='*80}\n")

        # Connect to databases
        remote_conn, local_conn = get_db_connections()
        local_cursor = local_conn.cursor()
        
        try:
            # Step 1: Try to identify account from XML
            print("🔍 Step 1: Identifying account from XML...")
            
            bog_result = identify_bog_gel_account(xml_file)
            
            if not bog_result:
                print("❌ Could not identify bank account from XML file")
                print("💡 Currently only BOG GEL format is supported")
                sys.exit(1)
            
            account_number, currency_code, _ = bog_result
            print(f"✅ Account identified: {account_number}")
            print(f"✅ Currency: {currency_code}\n")

            # Step 2: Look up account in database
            print("🔍 Step 2: Looking up account in database...")
            
            local_cursor.execute("""
                SELECT 
                    ba.uuid,
                    ba.account_number,
                    c.code as currency_code,
                    c.uuid as currency_uuid,
                    ps.scheme as parsing_scheme,
                    ba.raw_table_name,
                    b.bank_name
                FROM bank_accounts ba
                JOIN currencies c ON ba.currency_uuid = c.uuid
                LEFT JOIN parsing_schemes ps ON ba.parsing_scheme_uuid = ps.uuid
                LEFT JOIN banks b ON ba.bank_uuid = b.uuid
                WHERE ba.account_number = %s AND c.code = %s
            """, (account_number, currency_code))
            
            result = local_cursor.fetchone()
            
            if not result:
                print(f"❌ Account not found in database: {account_number} ({currency_code})")
                print("💡 Please create the bank account first in the system")
                sys.exit(1)
            
            account_uuid, account_number, currency_code, currency_uuid, parsing_scheme, raw_table_name, bank_name = result
            
            print(f"✅ Account found in database")
            print(f"   UUID: {account_uuid}")
            print(f"   Account: {account_number}")
            print(f"   Currency: {currency_code}")
            print(f"   Bank: {bank_name or 'Not specified'}")
            print(f"   Parsing Scheme: {parsing_scheme or 'Not specified'}")
            print(f"   Raw Table: {raw_table_name or 'Not specified'}\n")
            
            if not parsing_scheme:
                parsing_scheme = 'BOG_GEL'
                print(f"⚠️ No parsing scheme specified, defaulting to BOG_GEL\n")
            
            if not raw_table_name:
                print(f"❌ No raw_table_name configured for this account")
                print(f"💡 Please set raw_table_name in bank_accounts table")
                sys.exit(1)
            
            # Step 3: Process based on parsing scheme
            if parsing_scheme == 'BOG_GEL':
                process_bog_gel(xml_file, account_uuid, account_number, currency_code, 
                              raw_table_name, remote_conn, local_conn)
            else:
                print(f"❌ Unsupported parsing scheme: {parsing_scheme}")
                sys.exit(1)
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            local_cursor.close()
            local_conn.close()
            remote_conn.close()
    
    elif mode == 'backparse':
        # BACKPARSE MODE: Reprocess existing raw data
        account_uuid = None
        batch_id = None
        clear_consolidated = False
        
        # Parse optional arguments
        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i]
            if arg == '--account-uuid' and i + 1 < len(sys.argv):
                account_uuid = sys.argv[i + 1]
                i += 2
            elif arg == '--batch-id' and i + 1 < len(sys.argv):
                batch_id = sys.argv[i + 1]
                i += 2
            elif arg == '--clear':
                clear_consolidated = True
                i += 1
            else:
                print(f"❌ Unknown argument: {arg}")
                sys.exit(1)
        
        backparse_existing_data(account_uuid, batch_id, clear_consolidated)
    
    else:
        print(f"❌ Unknown mode: {mode}")
        print("Valid modes: import, backparse")
        sys.exit(1)

if __name__ == "__main__":
    main()
