"""
Bank XML Import Orchestrator - Comprehensive Three-Phase Processing
This script consolidates all XML import and processing logic:
1. Identifies bank account and parsing scheme
2. Parses XML and inserts raw data
3. Three-phase processing: Counteragent → Parsing Rules → Payment ID

Environment Detection:
- On Vercel (production): Uses Supabase for both raw and consolidated data
- On local: Uses LOCAL PostgreSQL for both raw and consolidated data
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

# Detect environment
IS_VERCEL = os.getenv('VERCEL') == '1' or os.getenv('VERCEL_ENV') is not None

# Set UTF-8 encoding for stdout/stderr on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

print(f"Environment: {'VERCEL (Production)' if IS_VERCEL else 'LOCAL (Development)'}")

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

def compute_case_description(case1, case2, case3, case4, case5, case6, case7, case8, applied_rule_id=None):
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
    
    # Phase 2: Parsing Rules
    if case6:
        rule_text = f"Case6 - parsing rule applied (ID: {applied_rule_id})" if applied_rule_id else "Case6 - parsing rule applied"
        cases.append(rule_text)
    elif case7:
        cases.append("Case7 - parsing rule kept (INN conflict)")
    
    # Phase 3: Payment ID
    if case4:
        cases.append("Case4 - payment ID matched")
    elif case5:
        cases.append("Case5 - payment ID conflict (Phase 1/2 kept)")
    
    if case8:
        cases.append("Case8 - rule dominance (overrides payment)")
    
    return "\n".join(cases) if cases else "No case matched"

def process_single_record(row, counteragents_map, parsing_rules, payments_map, idx, stats, missing_counteragents):
    """
    Common processing logic for a single BOG GEL record.
    Implements the three-phase hierarchy (by PRIORITY):
      PHASE 1: Parsing Rules (HIGHEST - immutable if matched)
      PHASE 2: Counteragent by INN (Second priority)
      PHASE 3: Payment ID (LOWEST - neglected if conflicts)
    
    Returns a dict with all processed values and flags.
    """
    # Extract raw fields
    DocKey = row.get('dockey')
    EntriesId = row.get('entriesid')
    DocSenderInn = row.get('docsenderinn')
    DocBenefInn = row.get('docbenefinn')
    DocCorAcct = row.get('doccoracct')
    DocSenderName = row.get('docsendername')
    DocBenefName = row.get('docbenefname')
    DocSenderAcctNo = row.get('docsenderacctno')
    DocBenefAcctNo = row.get('docbenefacctno')
    DocProdGroup = row.get('docprodgroup')
    DocNomination = row.get('docnomination')
    DocInformation = row.get('docinformation')
    debit = row.get('debit')
    credit = row.get('credit')
    
    # Initialize return values
    result = {
        'counteragent_uuid': None,
        'counteragent_account_number': None,
        'counteragent_inn': None,
        'project_uuid': None,
        'financial_code_uuid': None,
        'nominal_currency_uuid': None,
        'payment_id': None,
        'applied_rule_id': None,
        'case1_counteragent_processed': False,
        'case1_counteragent_found': False,
        'case3_counteragent_missing': False,
        'case4_payment_id_matched': False,
        'case5_payment_id_conflict': False,
        'case6_parsing_rule_applied': False,
        'case7_parsing_rule_conflict': False
    }
    
    # Extract counteragent account and INN (needed for all phases)
    counteragent_account_number = None
    if DocCorAcct and str(DocCorAcct).strip():
        counteragent_account_number = str(DocCorAcct).strip()
    
    is_incoming = (debit is None or debit == 0)
    if is_incoming:
        counteragent_inn = normalize_inn(DocSenderInn)
        if not counteragent_account_number and DocSenderAcctNo and str(DocSenderAcctNo).strip():
            counteragent_account_number = str(DocSenderAcctNo).strip()
    else:
        counteragent_inn = normalize_inn(DocBenefInn)
        if not counteragent_account_number and DocBenefAcctNo and str(DocBenefAcctNo).strip():
            counteragent_account_number = str(DocBenefAcctNo).strip()
    
    result['counteragent_inn'] = counteragent_inn
    result['counteragent_account_number'] = counteragent_account_number
    
    # =============================
    # PHASE 1: Parsing Rules (HIGHEST PRIORITY - IMMUTABLE)
    # =============================
    
    matched_rule = None
    for rule in parsing_rules:
        # Prefer condition_script for consistent UI logic
        condition_script = rule.get('condition_script')
        if condition_script:
            row_ctx = {
                'DocProdGroup': DocProdGroup,
                'DocNomination': DocNomination,
                'DocInformation': DocInformation,
                'DocKey': DocKey,
                'DocSenderInn': DocSenderInn,
                'DocBenefInn': DocBenefInn,
                'DocSenderAcctNo': DocSenderAcctNo,
                'DocBenefAcctNo': DocBenefAcctNo,
                'DocSenderName': DocSenderName,
                'DocBenefName': DocBenefName,
                'DocCorAcct': DocCorAcct,
                'EntryDbAmt': debit,
                'EntryCrAmt': credit
            }

            if evaluate_condition_script(condition_script, row_ctx):
                matched_rule = rule
                if idx <= 3:
                    print(f"    🎯 [PHASE 1 - RULE MATCH] condition_script (HIGHEST PRIORITY)")
                break

        # Fallback to legacy column_name/condition equality
        column_name = rule.get('column_name', '')
        condition = rule.get('condition', '')
        if not column_name or not condition:
            continue
        
        # Case-insensitive field mapping
        field_map_case_insensitive = {
            'docprodgroup': DocProdGroup,
            'docnomination': DocNomination,
            'docinformation': DocInformation,
            'dockey': DocKey
        }
        
        # Try both PascalCase and lowercase
        field_value = field_map_case_insensitive.get(column_name.lower())
        
        if field_value and str(field_value).strip() == str(condition).strip():
            matched_rule = rule
            if idx <= 3:
                print(f"    🎯 [PHASE 1 - RULE MATCH] {column_name}='{condition}' (HIGHEST PRIORITY)")
            break
    
    if matched_rule:
        rule_payment_id = matched_rule.get('payment_id')
        rule_payment_data = None
        if rule_payment_id:
            # Case-insensitive lookup
            rule_payment_id_lower = rule_payment_id.lower()
            if rule_payment_id_lower in payments_map:
                rule_payment_data = payments_map[rule_payment_id_lower]
                if idx <= 3:
                    print(f"    🎯 [RULE->PAYMENT] payment_id: {rule_payment_id}")
        
        # Store which rule was applied
        result['applied_rule_id'] = matched_rule['id']
        
        # Phase 1 has HIGHEST PRIORITY - sets counteragent (IMMUTABLE)
        rule_counteragent = matched_rule['counteragent_uuid']
        if not rule_counteragent and rule_payment_data:
            rule_counteragent = rule_payment_data['counteragent_uuid']
        
        if rule_counteragent:
            result['counteragent_uuid'] = rule_counteragent
            result['case6_parsing_rule_applied'] = True
        
        # Apply rule parameters (IMMUTABLE - highest priority)
        if matched_rule['financial_code_uuid']:
            result['financial_code_uuid'] = matched_rule['financial_code_uuid']
        elif rule_payment_data and rule_payment_data.get('financial_code_uuid'):
            result['financial_code_uuid'] = rule_payment_data['financial_code_uuid']
        
        if matched_rule['nominal_currency_uuid']:
            result['nominal_currency_uuid'] = matched_rule['nominal_currency_uuid']
        elif rule_payment_data and rule_payment_data.get('currency_uuid'):
            result['nominal_currency_uuid'] = rule_payment_data['currency_uuid']
        
        if rule_payment_data and rule_payment_data.get('project_uuid'):
            result['project_uuid'] = rule_payment_data['project_uuid']
        
        stats['case6_parsing_rule_match'] += 1
        
        if idx <= 3:
            print(f"    ✅ [PHASE 1] Parsing rule applied (IMMUTABLE)")
    
    # =============================
    # PHASE 2: Counteragent by INN (Second Priority)
    # =============================
    
    # Phase 2 can ONLY set counteragent if Phase 1 didn't set it
    if not result['counteragent_uuid'] and counteragent_inn:
        counteragent_data = counteragents_map.get(counteragent_inn)
        if counteragent_data:
            # Counteragent matched by INN
            result['counteragent_uuid'] = counteragent_data['uuid']
            result['case1_counteragent_processed'] = True
            result['case1_counteragent_found'] = True
            stats['case1_counteragent_processed'] += 1
            
            if idx <= 3:
                print(f"  ✅ [PHASE 2 - INN] Record {DocKey}_{EntriesId}: Matched counteragent {counteragent_data['name']}")
        else:
            # INN exists but no match in database
            result['case1_counteragent_processed'] = True
            result['case3_counteragent_missing'] = True
            stats['case3_counteragent_inn_nonblank_no_match'] += 1
            
            if counteragent_inn not in missing_counteragents:
                missing_counteragents[counteragent_inn] = {'inn': counteragent_inn, 'count': 0, 'samples': []}
            missing_counteragents[counteragent_inn]['count'] += 1
            if len(missing_counteragents[counteragent_inn]['samples']) < 3:
                missing_counteragents[counteragent_inn]['samples'].append(f"{DocKey}_{EntriesId}")
            
            if idx <= 3:
                print(f"  ⚠️  [PHASE 2] Record {DocKey}_{EntriesId}: INN {counteragent_inn} needs counteragent")
    elif result['counteragent_uuid'] and counteragent_inn:
        # Phase 1 already set counteragent, check if INN would suggest different one
        counteragent_data = counteragents_map.get(counteragent_inn)
        if counteragent_data and counteragent_data['uuid'] != result['counteragent_uuid']:
            result['case7_parsing_rule_conflict'] = True
            stats['case7_parsing_rule_counteragent_mismatch'] += 1
            if idx <= 3:
                print(f"    ℹ️  [PHASE 2 OVERRIDE] INN suggests different counteragent, but Phase 1 rule is immutable")
    
    # =============================
    # PHASE 3: Payment ID (LOWEST PRIORITY - Neglected if conflicts)
    # =============================
    
    extracted_payment_id = extract_payment_id(DocInformation)
    if extracted_payment_id:
        # Case-insensitive lookup
        payment_id_lower = extracted_payment_id.lower()
        if payment_id_lower in payments_map:
            payment_data = payments_map[payment_id_lower]
            payment_counteragent = payment_data['counteragent_uuid']
            
            # Phase 3 can ONLY set counteragent if Phase 1 AND Phase 2 didn't find one
            if result['counteragent_uuid']:
                # Check for conflict - if conflict, NEGLECT payment data
                if payment_counteragent and payment_counteragent != result['counteragent_uuid']:
                    result['case5_payment_id_conflict'] = True
                    stats['case5_payment_id_counteragent_mismatch'] += 1
                    if idx <= 3:
                        print(f"    ⚠️  [PHASE 3 NEGLECTED] Payment suggests different counteragent - keeping Phase 1/2 counteragent")
                    # DO NOT set payment_id or apply payment parameters - NEGLECTED due to conflict
                    return result
            else:
                # Neither Phase 1 nor Phase 2 found counteragent - Phase 3 can set it
                if payment_counteragent:
                    result['counteragent_uuid'] = payment_counteragent
            
            result['payment_id'] = extracted_payment_id
            
            # Apply payment parameters only if not already set by Phase 1
            if not result['project_uuid'] and payment_data['project_uuid']:
                result['project_uuid'] = payment_data['project_uuid']
            if not result['financial_code_uuid'] and payment_data['financial_code_uuid']:
                result['financial_code_uuid'] = payment_data['financial_code_uuid']
            if not result['nominal_currency_uuid'] and payment_data['currency_uuid']:
                result['nominal_currency_uuid'] = payment_data['currency_uuid']
        
        if not result['case5_payment_id_conflict']:
            result['case4_payment_id_matched'] = True
        stats['case4_payment_id_match'] += 1
        
        if idx <= 3:
            print(f"    ✅ [PHASE 3] Payment ID matched: {extracted_payment_id}")
    
    # =============================
    # PHASE 4: Reverse Payment Lookup (OPTIONAL - No conflicts, just link)
    # =============================
    # If we have counteragent + project + financial_code + currency but no payment_id yet,
    # try to find a matching payment record
    if (not result['payment_id'] and 
        result['counteragent_uuid'] and 
        result['financial_code_uuid'] and 
        result['nominal_currency_uuid']):
        
        # Build lookup key - project can be NULL
        lookup_key = f"{result['counteragent_uuid']}_{result['project_uuid']}_{result['financial_code_uuid']}_{result['nominal_currency_uuid']}"
        
        # Search payments_map for matching payment
        for payment_id, payment_data in payments_map.items():
            if (payment_data['counteragent_uuid'] == result['counteragent_uuid'] and
                payment_data['project_uuid'] == result['project_uuid'] and
                payment_data['financial_code_uuid'] == result['financial_code_uuid'] and
                payment_data['currency_uuid'] == result['nominal_currency_uuid']):
                result['payment_id'] = payment_id
                if idx <= 3:
                    print(f"    🔗 [REVERSE LOOKUP] Linked to payment: {payment_id}")
                break
    
    return result

def get_db_connections():
    """
    Get database connection - ALWAYS uses Supabase.
    Returns the same Supabase connection for both remote and local parameters
    for backward compatibility with existing code.
    
    All operations (raw data, consolidated data, dictionaries) happen on Supabase.
    """
    remote_db_url = None
    
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('REMOTE_DATABASE_URL='):
                    remote_db_url = line.split('=', 1)[1].strip('"').strip("'")
                    break
    except Exception as e:
        print(f"❌ Error reading .env.local: {e}")
        sys.exit(1)

    if not remote_db_url:
        raise ValueError("REMOTE_DATABASE_URL not found in .env.local")
    
    # CRITICAL FIX: Replace pooler port (6543) with direct port (5432)
    # Pooler (pgbouncer) has strict timeouts unsuitable for bulk operations
    if ':6543/' in remote_db_url:
        print("⚠️  Detected pooler connection (port 6543), switching to direct connection (5432)...")
        remote_db_url = remote_db_url.replace(':6543/', ':5432/')
        remote_db_url = remote_db_url.replace('pgbouncer=true', 'pgbouncer=false')
        remote_db_url = remote_db_url.replace('?&', '?')
        print("✅ Using direct connection (required for bulk operations)")
    
    # Parse and clean Supabase connection string
    parsed_remote = urlparse(remote_db_url)
    clean_remote_url = f"{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}"
    
    print("🔍 Connecting to Supabase...")
    supabase_conn = psycopg2.connect(
        clean_remote_url, 
        connect_timeout=30, 
        keepalives=1, 
        keepalives_idle=30
    )
    # Set statement timeout AFTER connection (0 = no timeout)
    cursor = supabase_conn.cursor()
    cursor.execute("SET statement_timeout = 0")
    cursor.close()
    # Use autocommit for this connection
    supabase_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    print("✅ Connected to Supabase (all operations on Supabase)")
    # Return same connection twice for backward compatibility
    return supabase_conn, supabase_conn

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
    """Parse BOG date format (YYYY-MM-DD) to date object"""
    if not date_str:
        return None
    try:
        return datetime.strptime(str(date_str).strip(), '%Y-%m-%d').date()
    except:
        return None

def calculate_nominal_amount(account_currency_amount, account_currency_code, nominal_currency_uuid, 
                             transaction_date, nbg_rates_map, currency_cache):
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
    
    if not nominal_currency_uuid:
        return nominal_amount
    
    # Get nominal currency code from cache
    if nominal_currency_uuid not in currency_cache:
        return nominal_amount
    
    nominal_currency_code = currency_cache[nominal_currency_uuid]
    
    # If account currency is same as nominal currency, no conversion needed
    if account_currency_code == nominal_currency_code:
        return account_currency_amount
    
    # Get NBG rate for the date
    date_key = transaction_date.strftime('%Y-%m-%d')
    if date_key not in nbg_rates_map:
        # No rate available for this date, return original amount
        return account_currency_amount
    
    # Case 1: GEL account → Foreign nominal currency (divide by rate)
    if account_currency_code == 'GEL' and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
        rate = nbg_rates_map[date_key].get(nominal_currency_code)
        if rate and rate > 0:
            # GEL → Foreign: divide by rate
            nominal_amount = account_currency_amount / Decimal(str(rate))
    
    # Case 2: Foreign account → GEL nominal currency (multiply by rate)
    elif account_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT'] and nominal_currency_code == 'GEL':
        rate = nbg_rates_map[date_key].get(account_currency_code)
        if rate and rate > 0:
            # Foreign → GEL: multiply by rate
            nominal_amount = account_currency_amount * Decimal(str(rate))
    
    # Case 3: Foreign → Different Foreign (convert through GEL)
    elif account_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT'] and nominal_currency_code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
        account_rate = nbg_rates_map[date_key].get(account_currency_code)
        nominal_rate = nbg_rates_map[date_key].get(nominal_currency_code)
        if account_rate and nominal_rate and account_rate > 0 and nominal_rate > 0:
            # Convert to GEL first, then to target currency
            gel_amount = account_currency_amount * Decimal(str(account_rate))
            nominal_amount = gel_amount / Decimal(str(nominal_rate))
    
    return nominal_amount

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
    
    # Strategy 4: Look for salary accrual payment ID pattern (NP_xxx_NJ_xxx_PRLxxx)
    # This matches the format: NP_{6hex}_NJ_{6hex}_PRL{MMYYYY}
    # Support both uppercase and lowercase hex (a-f, A-F)
    match = re.search(r'NP_[A-Fa-f0-9]{6}_NJ_[A-Fa-f0-9]{6}_PRL\d{6}', text)
    if match:
        return match.group(0)
    
    # Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars), treat as payment_id
    # Increased limit from 20 to 50 to accommodate longer payment IDs
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:
        return text
    
    return None

def evaluate_condition_script(script, row):
    """Evaluate a JS condition_script (compiled by compileFormulaToJS) against a Python dict row."""
    try:
        if not script:
            return False

        # Extract the expression inside: (function(row) { return <expr>; })
        match = re.search(r'return\s+(.*);\s*\}\s*\)?\s*$', script, re.DOTALL)
        expr = match.group(1) if match else script

        # Convert JS operators to Python
        expr = expr.replace('===', '==').replace('!==', '!=')
        expr = expr.replace('&&', ' and ').replace('||', ' or ')
        expr = re.sub(r'(?<![=!])!(?!=)', ' not ', expr)
        expr = expr.replace('null', 'None').replace('undefined', 'None')

        # Convert ternary: (cond ? a : b) -> (a if cond else b)
        ternary_pattern = re.compile(r'\(([^()]+?)\?([^:]+?):([^()]+?)\)')
        while True:
            new_expr, count = ternary_pattern.subn(r'(\2 if \1 else \3)', expr)
            expr = new_expr
            if count == 0:
                break

        # String() -> str()
        expr = re.sub(r'String\((.*?)\)', r'str(\1)', expr)

        # row.col -> row.get("col")
        expr = re.sub(r'row\.([A-Za-z_][A-Za-z0-9_]*)', r'row.get("\1")', expr)

        # JS string helpers
        expr = re.sub(r'\.toLowerCase\(\)', '.lower()', expr)
        expr = re.sub(r'\.toUpperCase\(\)', '.upper()', expr)
        expr = re.sub(r'(\S+)\.includes\(([^)]+)\)', r'(\2 in \1)', expr)
        expr = re.sub(r'(\S+)\.indexOf\(([^)]+)\)', r'(\1.find(\2))', expr)

        # Safe eval in restricted scope
        return bool(eval(expr, {"__builtins__": {}}, {"row": row}))
    except Exception as exc:
        print(f"⚠️ Error evaluating condition_script: {exc}")
        return False

def process_bog_gel(xml_file, account_uuid, account_number, currency_code, raw_table_name, 
                   remote_conn, _unused_conn):
    """
    Process BOG GEL XML file with three-phase hierarchy:
    Phase 1: Counteragent identification
    Phase 2: Parsing rules application
    Phase 3: Payment ID matching
    
    All operations on Supabase (remote_conn).
    _unused_conn parameter kept for backward compatibility.
    """
    
    remote_cursor = remote_conn.cursor()
    # All operations use remote_cursor (Supabase)
    
    print(f"\n{'='*80}")
    print(f"🚀 BOG GEL PROCESSING - Three-Phase Hierarchy")
    print(f"{'='*80}\n")
    
    # Get account details from Supabase
    remote_cursor.execute("""
        SELECT uuid, currency_uuid FROM bank_accounts 
        WHERE uuid = %s
    """, (account_uuid,))
    
    account_result = remote_cursor.fetchone()
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
    
    # Load counteragents from Supabase
    dict_start = time.time()
    remote_cursor.execute("""
        SELECT counteragent_uuid, identification_number, counteragent 
        FROM counteragents 
        WHERE identification_number IS NOT NULL
    """)
    counteragents_map = {}
    for row in remote_cursor.fetchall():
        inn = normalize_inn(row[1])
        if inn:
            counteragents_map[inn] = {
                'uuid': row[0],
                'name': row[2]
            }
    print(f"  ✅ Loaded {len(counteragents_map)} counteragents from Supabase ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load parsing rules from Supabase
    dict_start = time.time()
    print(f"  ⏳ Loading parsing rules from Supabase...")
    sys.stdout.flush()
    remote_cursor.execute("""
        SELECT 
            id,
            counteragent_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            column_name,
            condition,
            condition_script,
            payment_id
        FROM parsing_scheme_rules
    """)
    rows = remote_cursor.fetchall()
    print(f"  📊 Fetched {len(rows)} parsing rule records from Supabase")
    sys.stdout.flush()
    parsing_rules = []
    for row in rows:
        parsing_rules.append({
            'id': row[0],
            'counteragent_uuid': row[1],
            'financial_code_uuid': row[2],
            'nominal_currency_uuid': row[3],
            'column_name': row[4],
            'condition': row[5],
            'condition_script': row[6],
            'payment_id': row[7]
        })
    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules from Supabase ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load NBG exchange rates from Supabase
    dict_start = time.time()
    remote_cursor.execute("""
        SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
        FROM nbg_exchange_rates
    """)
    nbg_rates_map = {}
    for row in remote_cursor.fetchall():
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
    print(f"  ✅ Loaded NBG rates for {len(nbg_rates_map)} dates ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load payments and salary_accruals using UNION from Supabase
    dict_start = time.time()
    print(f"  ⏳ Loading payments and salary_accruals from Supabase...")
    sys.stdout.flush()
    remote_cursor.execute("""
        SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid, 'payments' as source
        FROM payments
        WHERE payment_id IS NOT NULL
        UNION ALL
        SELECT payment_id, counteragent_uuid, NULL as project_uuid, financial_code_uuid, nominal_currency_uuid, 'salary' as source
        FROM salary_accruals 
        WHERE payment_id IS NOT NULL
    """)
    
    payments_map = {}
    payments_count = 0
    salary_count = 0
    
    for row in remote_cursor.fetchall():
        payment_id = row[0].strip() if row[0] else None
        source = row[5]
        
        if payment_id:
            # Priority: payments table over salary_accruals (first occurrence wins)
            # Use lowercase key for case-insensitive matching
            payment_id_lower = payment_id.lower()
            if payment_id_lower not in payments_map:
                payments_map[payment_id_lower] = {
                    'payment_id': payment_id,
                    'counteragent_uuid': row[1],
                    'project_uuid': row[2],
                    'financial_code_uuid': row[3],
                    'currency_uuid': row[4],
                    'source': source
                }
                if source == 'payments':
                    payments_count += 1
                else:
                    salary_count += 1
    
    print(f"  ✅ Loaded {len(payments_map)} payment IDs from Supabase via UNION query ({time.time()-dict_start:.2f}s)")
    print(f"     └─ payments: {payments_count}, salary_accruals: {salary_count}")
    sys.stdout.flush()
    
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
            DocSenderAcctNo, DocBenefAcctNo, DocSenderName, DocBenefName,
            DocCorAcct, DocNomination, DocInformation, DocProdGroup, CcyRate
        FROM {raw_table_name}
        WHERE import_batch_id = %s
        ORDER BY DocValueDate DESC
    """, (import_batch_id,))
    
    raw_records = remote_cursor.fetchall()
    total_records = len(raw_records)
    print(f"📦 Processing {total_records} records...\n")
    
    # Load currency cache once (avoid repeated queries)
    print(f"  \ud83d\udd04 Loading currency cache...")
    remote_cursor.execute("SELECT uuid, code FROM currencies")
    currency_cache = {row[0]: row[1] for row in remote_cursor.fetchall()}
    print(f"  \u2705 Loaded {len(currency_cache)} currencies\n")
    
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
        DocSenderName = raw_record[11]
        DocBenefName = raw_record[12]
        DocCorAcct = raw_record[13]
        DocNomination = raw_record[14]
        DocInformation = raw_record[15]
        DocProdGroup = raw_record[16]
        CcyRate = raw_record[17]
        
        # Calculate amounts
        credit = Decimal(EntryCrAmt) if EntryCrAmt else Decimal('0')
        debit = Decimal(EntryDbAmt) if EntryDbAmt else Decimal('0')
        account_currency_amount = credit - debit
        

        # Parse dates
        transaction_date = parse_bog_date(DocValueDate)
        correction_date = parse_bog_date(DocRecDate)
        
        if not transaction_date:
            continue
        
        # Prepare row dict for shared processing function
        row = {
            'uuid': raw_uuid,
            'dockey': DocKey,
            'entriesid': EntriesId,
            'docsenderinn': DocSenderInn,
            'docbenefinn': DocBenefInn,
            'doccoracct': DocCorAcct,
            'docsenderacctno': DocSenderAcctNo,
            'docbenefacctno': DocBenefAcctNo,
            'docsendername': DocSenderName,
            'docbenefname': DocBenefName,
            'docprodgroup': DocProdGroup,
            'docnomination': DocNomination,
            'docinformation': DocInformation,
            'entrydbamt': debit,
            'entrycramt': credit,
            'debit': debit,
            'credit': credit
        }
        
        # ===== USE SHARED PROCESSING FUNCTION =====
        result = process_single_record(
            row, 
            counteragents_map, 
            parsing_rules, 
            payments_map, 
            idx, 
            stats, 
            missing_counteragents
        )
        
        # Extract results from shared function
        counteragent_uuid = result['counteragent_uuid']
        counteragent_account_number = result['counteragent_account_number']
        counteragent_inn = result['counteragent_inn']
        project_uuid = result['project_uuid']
        financial_code_uuid = result['financial_code_uuid']
        payment_id = result['payment_id']
        
        # Set defaults for missing values
        # Calculate nominal amount using NBG exchange rates
        nominal_currency_uuid = result['nominal_currency_uuid'] or account_currency_uuid
        nominal_amount = calculate_nominal_amount(
            account_currency_amount,
            currency_code,
            nominal_currency_uuid,
            transaction_date,
            nbg_rates_map,
            currency_cache
        )
        
        # Generate case description (case2 and case8 deprecated, set to False)
        case_description = compute_case_description(
            result['case1_counteragent_processed'],
            False,  # case2 merged into case1
            result['case3_counteragent_missing'],
            result['case4_payment_id_matched'],
            result['case5_payment_id_conflict'],
            result['case6_parsing_rule_applied'],
            result['case7_parsing_rule_conflict'],
            False,  # case8 merged into other flags
            result.get('applied_rule_id')
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
            'payment_id': result.get('payment_id'),
            'account_currency_uuid': account_currency_uuid,
            'account_currency_amount': float(account_currency_amount),
            'nominal_currency_uuid': nominal_currency_uuid,
            'nominal_amount': float(nominal_amount),
            'processing_case': case_description,
            'applied_rule_id': result.get('applied_rule_id')
        })
        
        # Prepare raw table update with correct result dict keys
        raw_updates.append({
            'uuid': raw_uuid,
            'counteragent_processed': result['case1_counteragent_processed'],
            'counteragent_found': result['case1_counteragent_found'],
            'counteragent_missing': result['case3_counteragent_missing'],
            'payment_id_matched': result['case4_payment_id_matched'],
            'payment_id_conflict': result['case5_payment_id_conflict'],
            'parsing_rule_applied': result['case6_parsing_rule_applied'],
            'parsing_rule_conflict': result['case7_parsing_rule_conflict'],
            'counteragent_inn': counteragent_inn,
            'applied_rule_id': result['applied_rule_id'],
            'processing_case': case_description
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
    print(f"\n{'='*80}")
    print(f"📊 STEP 4: Preparing to insert {len(consolidated_records)} consolidated records")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    
    step_start = log_step(4, f"INSERTING {len(consolidated_records)} CONSOLIDATED RECORDS")
    
    if consolidated_records:
        print(f"  🚀 Starting batch insert of {len(consolidated_records)} records to Supabase...")
        print(f"  ℹ️  Insert will use chunks of 5000 records...")
        sys.stdout.flush()
        insert_start = time.time()
        
        insert_consolidated_query = """
            INSERT INTO consolidated_bank_accounts (
                uuid, bank_account_uuid, raw_record_uuid, transaction_date,
                description, counteragent_uuid, counteragent_account_number,
                project_uuid, financial_code_uuid, payment_id,
                account_currency_uuid, account_currency_amount,
                nominal_currency_uuid, nominal_amount,
                processing_case, created_at
            ) VALUES (
                %(uuid)s, %(bank_account_uuid)s, %(raw_record_uuid)s, %(transaction_date)s,
                %(description)s, %(counteragent_uuid)s, %(counteragent_account_number)s,
                %(project_uuid)s, %(financial_code_uuid)s, %(payment_id)s,
                %(account_currency_uuid)s, %(account_currency_amount)s,
                %(nominal_currency_uuid)s, %(nominal_amount)s,
                %(processing_case)s, NOW()
            )
            ON CONFLICT (uuid) DO UPDATE SET
                counteragent_uuid = EXCLUDED.counteragent_uuid,
                counteragent_account_number = EXCLUDED.counteragent_account_number,
                project_uuid = EXCLUDED.project_uuid,
                financial_code_uuid = EXCLUDED.financial_code_uuid,
                payment_id = EXCLUDED.payment_id,
                nominal_currency_uuid = EXCLUDED.nominal_currency_uuid,
                nominal_amount = EXCLUDED.nominal_amount,
                processing_case = EXCLUDED.processing_case,
                updated_at = NOW()
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
    print(f"\n{'='*80}")
    print(f"📊 STEP 5: Preparing to update {len(raw_updates)} raw table flags")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    
    step_start = log_step(5, f"UPDATING {len(raw_updates)} RAW TABLE FLAGS")
    
    if raw_updates:
        # Note: This query is not actually used - we use bulk COPY/UPDATE instead
        # Keeping for reference only
        update_raw_query = f"""
            UPDATE {raw_table_name} SET
                counteragent_processed = %(case1_counteragent_processed)s,
                counteragent_found = %(case1_counteragent_found)s,
                counteragent_missing = %(case3_counteragent_missing)s,
                payment_id_matched = %(case4_payment_id_matched)s,
                payment_id_conflict = %(case5_payment_id_conflict)s,
                parsing_rule_applied = %(case6_parsing_rule_applied)s,
                parsing_rule_conflict = %(case7_parsing_rule_conflict)s,
                parsing_rule_processed = TRUE,
                payment_id_processed = TRUE,
                counteragent_inn = %(counteragent_inn)s,
                processing_case = %(processing_case)s,
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
                counteragent_processed BOOLEAN,
                counteragent_found BOOLEAN,
                counteragent_missing BOOLEAN,
                payment_id_matched BOOLEAN,
                payment_id_conflict BOOLEAN,
                parsing_rule_applied BOOLEAN,
                parsing_rule_conflict BOOLEAN,
                counteragent_inn TEXT,
                applied_rule_id INTEGER,
                processing_case TEXT
            )
        """)
        
        # Use COPY for fast bulk insert to temp table
        print(f"  ⬆️ Copying {len(raw_updates)} records to temp table...")
        sys.stdout.flush()
        from io import StringIO
        buffer = StringIO()
        for update in raw_updates:
            inn = update.get('counteragent_inn', '')
            if inn is None:
                inn = ''
            processing_case = update.get('processing_case', '').replace('\n', ' ')
            applied_rule = update.get('applied_rule_id')
            if applied_rule is None or applied_rule == '':
                applied_rule = '\\N'  # PostgreSQL NULL for COPY
            buffer.write(f"{update['uuid']}\t{update['case1_counteragent_processed']}\t{update['case1_counteragent_found']}\t{update['case3_counteragent_missing']}\t{update['case4_payment_id_matched']}\t{update['case5_payment_id_conflict']}\t{update['case6_parsing_rule_applied']}\t{update['case7_parsing_rule_conflict']}\t{inn}\t{applied_rule}\t{processing_case}\n")
        buffer.seek(0)
        remote_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'counteragent_processed', 'counteragent_found', 'counteragent_missing', 'payment_id_matched', 'payment_id_conflict', 'parsing_rule_applied', 'parsing_rule_conflict', 'counteragent_inn', 'applied_rule_id', 'processing_case'))
        copy_time = time.time() - update_start
        print(f"  ✅ Temp table loaded in {copy_time:.2f}s")
        sys.stdout.flush()
        
        # Bulk update from temp table (single operation)
        print(f"  🔄 Executing bulk UPDATE FROM temp table...")
        sys.stdout.flush()
        remote_cursor.execute(f"""
            UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.counteragent_processed,
                counteragent_found = tmp.counteragent_found,
                counteragent_missing = tmp.counteragent_missing,
                payment_id_matched = tmp.payment_id_matched,
                payment_id_conflict = tmp.payment_id_conflict,
                parsing_rule_applied = tmp.parsing_rule_applied,
                parsing_rule_conflict = tmp.parsing_rule_conflict,
                parsing_rule_processed = TRUE,
                payment_id_processed = TRUE,
                counteragent_inn = tmp.counteragent_inn,
                applied_rule_id = tmp.applied_rule_id,
                processing_case = tmp.processing_case,
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
    ALL OPERATIONS USE SUPABASE.
    """
    
    print(f"\n{'='*80}")
    print(f"🔄 BACKPARSE MODE - Reprocessing Existing Raw Data")
    print(f"{'='*80}\n")
    
    # Connect to Supabase (all operations)
    print("🔍 Connecting to Supabase...")
    supabase_conn, _ = get_db_connections()
    supabase_cursor = supabase_conn.cursor()
    print("✅ Connected to Supabase (all operations)\n")
    
    try:
        # Get account information
        if account_uuid:
            print(f"🔍 Looking up account by UUID: {account_uuid}...")
            supabase_cursor.execute("""
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
            supabase_cursor.execute("""
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
        
        accounts = supabase_cursor.fetchall()
        
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
            # NOTE: Skipping DELETE due to Supabase timeout on large deletes
            # Instead, we'll use INSERT ... ON CONFLICT DO UPDATE (upsert)
            if clear_consolidated:
                print(f"⚠️  Skipping DELETE (would timeout on large datasets)")
                print(f"ℹ️  Will use UPSERT to handle existing records\n")
            else:
                # Only reset flags if not clearing (incremental mode)
                print(f"🔄 Resetting is_processed flags...")
                if batch_id:
                    supabase_cursor.execute(f"""
                        UPDATE {raw_table_name} 
                        SET is_processed = FALSE
                        WHERE import_batch_id = %s
                    """, (batch_id,))
                else:
                    supabase_cursor.execute(f"""
                        UPDATE {raw_table_name} 
                        SET is_processed = FALSE
                    """)
                supabase_conn.commit()
                print(f"✅ Processing flags reset\n")
            
            # Now run the three-phase processing on existing data
            # We'll reuse the processing logic but without XML import
            backparse_bog_gel(acc_uuid, acc_number, currency_code, raw_table_name, 
                            supabase_conn, batch_id)
        
        print(f"\n{'='*80}")
        print(f"✅ Backparse completed successfully!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        supabase_cursor.close()
        supabase_conn.close()

def backparse_bog_gel(account_uuid, account_number, currency_code, raw_table_name, 
                     supabase_conn, batch_id=None):
    """
    Backparse existing BOG GEL raw data (without XML import step)
    Uses the same three-phase processing logic as process_bog_gel
    All operations on Supabase.
    """
    
    supabase_cursor = supabase_conn.cursor()
    
    print(f"🚀 BOG GEL BACKPARSE - Three-Phase Hierarchy")
    print(f"   └─ All operations on Supabase\n")
    
    # Get account details from Supabase
    supabase_cursor.execute("""
        SELECT uuid, currency_uuid FROM bank_accounts 
        WHERE uuid = %s
    """, (account_uuid,))
    
    account_result = supabase_cursor.fetchone()
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
    
    # Load counteragents from Supabase with retry
    dict_start = time.time()
    print(f"  ⏳ Loading counteragents from Supabase...")
    sys.stdout.flush()
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"    🔄 Attempt {attempt + 1}/{max_retries} - Executing query...")
            sys.stdout.flush()
            supabase_cursor.execute("""
                SELECT counteragent_uuid, identification_number, counteragent 
                FROM counteragents 
                WHERE identification_number IS NOT NULL
            """)
            print(f"    🔄 Query executed, fetching results...")
            sys.stdout.flush()
            counteragents_map = {}
            for row in supabase_cursor.fetchall():
                inn = normalize_inn(row[1])
                if inn:
                    counteragents_map[inn] = {
                        'uuid': row[0],
                        'name': row[2]
                    }
            print(f"  ✅ Loaded {len(counteragents_map)} counteragents from Supabase ({time.time()-dict_start:.2f}s)")
            break
        except Exception as e:
            print(f"    ⚠️ Failed: {type(e).__name__}")
            if attempt < max_retries - 1:
                time.sleep(2)
                try:
                    supabase_cursor.close()
                    supabase_cursor = supabase_conn.cursor()
                except:
                    pass
            else:
                print(f"  ❌ Failed to load counteragents after {max_retries} attempts")
                raise
    
    # Load parsing rules from Supabase
    dict_start = time.time()
    supabase_cursor.execute("""
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
    for row in supabase_cursor.fetchall():
        # Parse condition field which can be:
        # - "column_name" + "value" (column_name and condition separate)
        # - or "column_name=\"value\"" (combined in condition field)
        column_name = row[5]  # may be NULL
        condition = row[6]
        
        # If column_name is NULL but condition has format like: docprodgroup="COM"
        if not column_name and condition and '=' in condition:
            # Parse: docprodgroup="COM" -> column=docprodgroup, value=COM
            parts = condition.split('=', 1)
            if len(parts) == 2:
                column_name = parts[0].strip()
                condition = parts[1].strip().strip('"\'')
        
        parsing_rules.append({
            'id': row[0],
            'counteragent_uuid': row[1],
            'financial_code_uuid': row[2],
            'nominal_currency_uuid': row[3],
            'payment_id': row[4],
            'column_name': column_name,
            'condition': condition
        })
    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules from Supabase ({time.time()-dict_start:.2f}s)")
    
    # Load NBG exchange rates from Supabase
    dict_start = time.time()
    supabase_cursor.execute("""
        SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
        FROM nbg_exchange_rates
    """)
    nbg_rates_map = {}
    for row in supabase_cursor.fetchall():
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
    print(f"  ✅ Loaded NBG rates for {len(nbg_rates_map)} dates from Supabase ({time.time()-dict_start:.2f}s)")
    
    # Load payments and salary_accruals using UNION from Supabase
    dict_start = time.time()
    print(f"  ⏳ Loading payments and salary_accruals from Supabase...")
    supabase_cursor.execute("""
        SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid, 'payments' as source
        FROM payments
        WHERE payment_id IS NOT NULL
        UNION ALL
        SELECT payment_id, counteragent_uuid, NULL as project_uuid, financial_code_uuid, nominal_currency_uuid, 'salary' as source
        FROM salary_accruals 
        WHERE payment_id IS NOT NULL
    """)
    
    payments_map = {}
    payments_count = 0
    salary_count = 0
    
    for row in supabase_cursor.fetchall():
        payment_id = row[0].strip() if row[0] else None
        source = row[5]
        
        if payment_id:
            # Priority: payments table over salary_accruals (first occurrence wins)
            # Use lowercase key for case-insensitive matching
            payment_id_lower = payment_id.lower()
            if payment_id_lower not in payments_map:
                payments_map[payment_id_lower] = {
                    'payment_id': payment_id,
                    'counteragent_uuid': row[1],
                    'project_uuid': row[2],
                    'financial_code_uuid': row[3],
                    'currency_uuid': row[4],
                    'source': source
                }
                if source == 'payments':
                    payments_count += 1
                else:
                    salary_count += 1
    
    print(f"  ✅ Loaded {len(payments_map)} payment IDs from Supabase via UNION query ({time.time()-dict_start:.2f}s)")
    print(f"     └─ payments: {payments_count}, salary_accruals: {salary_count}")
    
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
                DocNomination, DocInformation, DocProdGroup, CcyRate
            FROM {raw_table_name}
            WHERE import_batch_id = %s
        """
        params = (batch_id,)
    else:
        query = f"""
            SELECT 
                uuid, DocKey, EntriesId, DocRecDate, DocValueDate,
                EntryCrAmt, EntryDbAmt, DocSenderInn, DocBenefInn,
                DocSenderAcctNo, DocBenefAcctNo, DocCorAcct,
                DocNomination, DocInformation, DocProdGroup, CcyRate
            FROM {raw_table_name}
            WHERE DocValueDate IS NOT NULL
        """
        params = ()
    
    # Fetch records in batches to avoid timeout with large Georgian text data
    print(f"\n{'='*80}")
    print(f"📦 STEP: Fetching records from database in batches (batch_size={1000})...")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    fetch_start = time.time()
    
    raw_records = []
    batch_size = 1000
    offset = 0
    
    while True:
        batch_query = f"{query.rstrip()} LIMIT {batch_size} OFFSET {offset}"
        
        try:
            print(f"  🔄 Fetching batch at offset {offset}...", end='', flush=True)
            batch_fetch_start = time.time()
            supabase_cursor.execute(batch_query, params)
            print(f" [executed in {time.time()-batch_fetch_start:.1f}s]...", end='', flush=True)
            batch = supabase_cursor.fetchall()
            print(f" [fetched in {time.time()-batch_fetch_start:.1f}s]...", end='', flush=True)
            
            if not batch:
                break  # No more records
            
            raw_records.extend(batch)
            offset += len(batch)
            print(f" ✅ Got {len(batch)} records (total: {len(raw_records)})")
            
            if len(batch) < batch_size:
                break  # Last batch
                
        except Exception as e:
            print(f"\n  ⚠️ Fetch failed at offset {offset}: {type(e).__name__}")
            print(f"  ℹ️  Continuing with {len(raw_records)} records already fetched...")
            # Continue with what we have
            break
    
    total_records = len(raw_records)
    
    print(f"  ✅ Loaded {total_records} records in {time.time()-fetch_start:.2f}s\n")
    sys.stdout.flush()
    
    # Load currency cache once (avoid repeated queries)
    print(f"  🔄 Loading currency cache...")
    sys.stdout.flush()
    supabase_cursor.execute("SELECT uuid, code FROM currencies")
    currency_cache = {row[0]: row[1] for row in supabase_cursor.fetchall()}
    print(f"  ✅ Loaded {len(currency_cache)} currencies\n")
    sys.stdout.flush()
    
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
    print(f"\n{'='*80}")
    print(f"🔄 Starting record processing loop ({total_records} records)...")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    
    for idx, raw_record in enumerate(raw_records, 1):
        # Log progress every 100 records
        if idx % 100 == 0 or idx == 1:
            elapsed = time.time() - step_start
            pct = idx * 100 // total_records
            print(f"  📊 Processing record {idx:,}/{total_records:,} ({pct}%) - {elapsed:.1f}s elapsed")
            sys.stdout.flush()
        
        # Log every 1000 records with more detail
        if idx % 1000 == 0:
            print(f"  ℹ️  Consolidated records so far: {len(consolidated_records)}, Raw updates: {len(raw_updates)}")
            sys.stdout.flush()
        
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
        CcyRate = raw_record[15]
        
        # Calculate amounts
        credit = Decimal(EntryCrAmt) if EntryCrAmt else Decimal('0')
        debit = Decimal(EntryDbAmt) if EntryDbAmt else Decimal('0')
        account_currency_amount = credit - debit
        

        # Parse dates
        transaction_date = parse_bog_date(DocValueDate)
        correction_date = parse_bog_date(DocRecDate)
        
        if not transaction_date:
            continue
        
        # Prepare row dict for shared processing function
        row = {
            'uuid': raw_uuid,
            'dockey': DocKey,
            'entriesid': EntriesId,
            'docsenderinn': DocSenderInn,
            'docbenefinn': DocBenefInn,
            'doccorracct': DocCorAcct,
            'docsenderacctno': DocSenderAcctNo,
            'docbenefacctno': DocBenefAcctNo,
            'docprodgroup': DocProdGroup,
            'docnomination': DocNomination,
            'docinformation': DocInformation,
            'debit': debit
        }
        
        # ===== USE SHARED PROCESSING FUNCTION =====
        result = process_single_record(
            row, 
            counteragents_map, 
            parsing_rules, 
            payments_map, 
            idx, 
            stats, 
            missing_counteragents
        )
        
        # Extract results from shared function
        counteragent_uuid = result['counteragent_uuid']
        counteragent_account_number = result['counteragent_account_number']
        counteragent_inn = result['counteragent_inn']
        project_uuid = result['project_uuid']
        financial_code_uuid = result['financial_code_uuid']
        payment_id = result['payment_id']
        
        # Set defaults for missing values
        # Calculate nominal amount using NBG exchange rates
        nominal_currency_uuid = result['nominal_currency_uuid'] or account_currency_uuid
        nominal_amount = calculate_nominal_amount(
            account_currency_amount,
            currency_code,
            nominal_currency_uuid,
            transaction_date,
            nbg_rates_map,
            currency_cache
        )
        
        # Generate case description (case2 and case8 deprecated, set to False)
        case_description = compute_case_description(
            result['case1_counteragent_processed'],
            False,  # case2 merged into case1
            result['case3_counteragent_missing'],
            result['case4_payment_id_matched'],
            result['case5_payment_id_conflict'],
            result['case6_parsing_rule_applied'],
            result['case7_parsing_rule_conflict'],
            False,  # case8 merged into other flags
            result.get('applied_rule_id')
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
            'payment_id': result.get('payment_id'),
            'account_currency_uuid': account_currency_uuid,
            'account_currency_amount': float(account_currency_amount),
            'nominal_currency_uuid': nominal_currency_uuid,
            'nominal_amount': float(nominal_amount),
            'processing_case': case_description,
            'applied_rule_id': result.get('applied_rule_id')
        })
        
        # Prepare raw table update with correct result dict keys
        raw_updates.append({
            'uuid': raw_uuid,
            'counteragent_processed': result['case1_counteragent_processed'],
            'counteragent_found': result['case1_counteragent_found'],
            'counteragent_missing': result['case3_counteragent_missing'],
            'payment_id_matched': result['case4_payment_id_matched'],
            'payment_id_conflict': result['case5_payment_id_conflict'],
            'parsing_rule_applied': result['case6_parsing_rule_applied'],
            'parsing_rule_conflict': result['case7_parsing_rule_conflict'],
            'counteragent_inn': counteragent_inn,
            'applied_rule_id': result['applied_rule_id'],
            'processing_case': case_description
        })
        
        if idx % 1000 == 0 or idx == total_records:
            elapsed = time.time() - step_start
            records_per_sec = idx / elapsed if elapsed > 0 else 0
            remaining = (total_records - idx) / records_per_sec if records_per_sec > 0 else 0
            print(f"\r  📊 Progress: {idx}/{total_records} ({idx*100//total_records}%) | {records_per_sec:.1f} rec/s | ETA: {remaining:.1f}s", end='', flush=True)
    
    print(f"\n  ✅ Processing loop completed: {len(consolidated_records)} consolidated records, {len(raw_updates)} raw updates")
    sys.stdout.flush()
    log_step(3, "THREE-PHASE PROCESSING", step_start)
    
    # ===================
    # STEP 4: Insert Consolidated Records (ULTRA-FAST COPY METHOD)
    # ===================
    print(f"\n{'='*80}")
    print(f"📊 STEP 4: Preparing to insert {len(consolidated_records)} consolidated records")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    
    step_start = log_step(4, f"INSERTING {len(consolidated_records)} CONSOLIDATED RECORDS")
    
    if consolidated_records:
        print(f"  🚀 Starting ULTRA-FAST COPY insert of {len(consolidated_records)} records to Supabase...")
        sys.stdout.flush()
        insert_start = time.time()
        
        # Use COPY for ultra-fast bulk insert (same method as raw table updates)
        from io import StringIO
        
        print(f"  ℹ️  Preparing buffer for COPY operation...")
        sys.stdout.flush()
        buffer_start = time.time()
        buffer = StringIO()
        
        for idx, rec in enumerate(consolidated_records, 1):
            if idx % 10000 == 0:
                print(f"    📝 Prepared {idx}/{len(consolidated_records)} rows...")
                sys.stdout.flush()
            
            # Format values for COPY (tab-separated, NULL for None values)
            # Remove null bytes and escape backslashes for PostgreSQL COPY format
            def clean_string(s):
                if not s:
                    return ''
                # Replace null bytes, tabs, newlines, carriage returns
                # Escape backslashes (must be done BEFORE other escapes)
                s = str(s).replace('\\', '\\\\')
                s = s.replace('\x00', '')
                s = s.replace('\t', ' ')
                s = s.replace('\n', ' ')
                s = s.replace('\r', '')
                return s
            
            values = [
                str(rec['uuid']),
                str(rec['bank_account_uuid']),
                str(rec['raw_record_uuid']),
                str(rec['transaction_date']),
                clean_string(rec['description']),
                str(rec['counteragent_uuid']) if rec['counteragent_uuid'] else '\\N',
                clean_string(rec['counteragent_account_number']) if rec['counteragent_account_number'] else '\\N',
                str(rec['project_uuid']) if rec['project_uuid'] else '\\N',
                str(rec['financial_code_uuid']) if rec['financial_code_uuid'] else '\\N',
                clean_string(rec['payment_id']) if rec['payment_id'] else '\\N',
                str(rec['account_currency_uuid']),
                str(rec['account_currency_amount']),
                str(rec['nominal_currency_uuid']),
                str(rec['nominal_amount']),
                clean_string(rec['processing_case']),
                str(rec['applied_rule_id']) if rec.get('applied_rule_id') else '\\N'
            ]
            buffer.write('\t'.join(values) + '\n')
        
        buffer.seek(0)
        buffer_time = time.time() - buffer_start
        print(f"  ✅ Buffer prepared in {buffer_time:.2f}s ({len(consolidated_records)/(buffer_time):.0f} rows/s)")
        sys.stdout.flush()
        
        print(f"  ⏳ Executing COPY FROM buffer to consolidated_bank_accounts (this is fast!)...")
        sys.stdout.flush()
        copy_start = time.time()
        
        supabase_cursor.copy_from(
            buffer,
            'consolidated_bank_accounts',
            columns=(
                'uuid', 'bank_account_uuid', 'raw_record_uuid', 'transaction_date',
                'description', 'counteragent_uuid', 'counteragent_account_number',
                'project_uuid', 'financial_code_uuid', 'payment_id',
                'account_currency_uuid', 'account_currency_amount',
                'nominal_currency_uuid', 'nominal_amount', 'processing_case',
                'applied_rule_id'
            )
        )
        
        copy_time = time.time() - copy_start
        print(f"  ✅ COPY completed in {copy_time:.2f}s ({len(consolidated_records)/copy_time:.0f} rec/s)")
        sys.stdout.flush()
        
        print(f"  ⏳ Committing consolidated records to Supabase...")
        sys.stdout.flush()
        commit_start = time.time()
        supabase_conn.commit()
        commit_time = time.time() - commit_start
        print(f"  ✅ Committed in {commit_time:.2f}s")
        print(f"  📊 Total insert time: {time.time()-insert_start:.2f}s ({len(consolidated_records)/(time.time()-insert_start):.0f} rec/s)")
        sys.stdout.flush()
        
        log_step(4, "CONSOLIDATED RECORDS INSERTION", step_start)
    
    # ===================
    # STEP 5: Update Raw Table Flags (LOCAL DB only has is_processed)
    # ===================
    print(f"\n{'='*80}")
    print(f"📊 STEP 5: Preparing to update {len(raw_updates)} raw table flags in {raw_table_name}")
    print(f"{'='*80}\n")
    sys.stdout.flush()
    
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
        supabase_cursor.execute("""
            DROP TABLE IF EXISTS temp_flag_updates;
            CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                counteragent_processed BOOLEAN,
                counteragent_found BOOLEAN,
                counteragent_missing BOOLEAN,
                payment_id_matched BOOLEAN,
                payment_id_conflict BOOLEAN,
                parsing_rule_applied BOOLEAN,
                parsing_rule_conflict BOOLEAN,
                counteragent_inn TEXT,
                applied_rule_id INTEGER,
                processing_case TEXT
            )
        """)
        
        # Use COPY for fast bulk insert to temp table
        print(f"  ⬆️ Copying {len(raw_updates)} records to temp table using COPY...")
        print(f"  ℹ️  Preparing buffer with {len(raw_updates)} rows...")
        sys.stdout.flush()
        copy_start = time.time()
        from io import StringIO
        buffer = StringIO()
        for idx, update in enumerate(raw_updates, 1):
            if idx % 10000 == 0:
                print(f"    📝 Prepared {idx}/{len(raw_updates)} rows...")
                sys.stdout.flush()
            inn = update['counteragent_inn'] or ''
            processing_case = update['processing_case'].replace('\n', '\\n') if update['processing_case'] else ''
            applied_rule = update.get('applied_rule_id')
            if applied_rule is None or applied_rule == '':
                applied_rule = '\\N'  # PostgreSQL NULL for COPY
            buffer.write(f"{update['uuid']}\t{update['counteragent_processed']}\t{update['counteragent_found']}\t{update['counteragent_missing']}\t{update['payment_id_matched']}\t{update['payment_id_conflict']}\t{update['parsing_rule_applied']}\t{update['parsing_rule_conflict']}\t{inn}\t{applied_rule}\t{processing_case}\n")
        
        print(f"  ℹ️  Buffer prepared ({len(raw_updates)} rows), starting COPY FROM...")
        sys.stdout.flush()
        buffer.seek(0)
        supabase_cursor.copy_from(buffer, 'temp_flag_updates', columns=('uuid', 'counteragent_processed', 'counteragent_found', 'counteragent_missing', 'payment_id_matched', 'payment_id_conflict', 'parsing_rule_applied', 'parsing_rule_conflict', 'counteragent_inn', 'applied_rule_id', 'processing_case'))
        copy_time = time.time() - copy_start
        print(f"  ✅ Temp table loaded in {copy_time:.2f}s")
        sys.stdout.flush()
        
        # Bulk update from temp table - use batching to avoid timeouts
        print(f"  🔄 Executing batched bulk UPDATE FROM temp table...")
        print(f"  ℹ️  Will process in 10,000-record batches to avoid timeout...")
        sys.stdout.flush()
        
        bulk_update_start = time.time()
        batch_size = 10000
        total_updated = 0
        
        # Get unique UUIDs from temp table to batch process
        supabase_cursor.execute("SELECT uuid FROM temp_flag_updates")
        all_uuids = [row[0] for row in supabase_cursor.fetchall()]
        total_batches = (len(all_uuids) + batch_size - 1) // batch_size
        
        print(f"  📦 Processing {len(all_uuids)} records in {total_batches} batches...")
        sys.stdout.flush()
        
        for batch_num in range(0, len(all_uuids), batch_size):
            batch_uuids = all_uuids[batch_num:batch_num + batch_size]
            batch_idx = batch_num // batch_size + 1
            
            print(f"    ⏳ Batch {batch_idx}/{total_batches} ({len(batch_uuids)} rows)...", end='', flush=True)
            batch_start = time.time()
            
            # Create placeholders for IN clause
            placeholders = ','.join(['%s'] * len(batch_uuids))
            
            supabase_cursor.execute(f"""
                UPDATE {raw_table_name} AS raw SET
                    counteragent_processed = tmp.counteragent_processed,
                    counteragent_found = tmp.counteragent_found,
                    counteragent_missing = tmp.counteragent_missing,
                    payment_id_matched = tmp.payment_id_matched,
                    payment_id_conflict = tmp.payment_id_conflict,
                    parsing_rule_applied = tmp.parsing_rule_applied,
                    parsing_rule_conflict = tmp.parsing_rule_conflict,
                    counteragent_inn = tmp.counteragent_inn,
                    applied_rule_id = tmp.applied_rule_id,
                    is_processed = TRUE,
                    updated_at = NOW()
                FROM temp_flag_updates AS tmp
                WHERE raw.uuid = tmp.uuid
                AND raw.uuid IN ({placeholders})
            """, batch_uuids)
            
            rows_updated = supabase_cursor.rowcount
            total_updated += rows_updated
            
            print(f" ✅ {time.time()-batch_start:.2f}s ({rows_updated} rows)")
            sys.stdout.flush()
        
        bulk_time = time.time() - bulk_update_start
        print(f"  ✅ All batches completed in {bulk_time:.2f}s ({total_updated} total rows, {total_updated/bulk_time:.0f} rows/s)")
        sys.stdout.flush()
        
        print(f"  ⏳ Committing transaction to Supabase (this is the final step)...")
        sys.stdout.flush()
        commit_start = time.time()
        supabase_conn.commit()
        commit_time = time.time() - commit_start
        print(f"  ✅ Transaction committed in {commit_time:.2f}s")
        print(f"  📊 Total update time: {time.time()-update_start:.2f}s")
        sys.stdout.flush()
        
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

        # Connect to Supabase (all operations)
        supabase_conn, _ = get_db_connections()
        supabase_cursor = supabase_conn.cursor()
        
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
            
            supabase_cursor.execute("""
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
            
            result = supabase_cursor.fetchone()
            
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
                parsing_scheme = 'BOG_GEL' if currency_code == 'GEL' else f"BOG_{currency_code}"
                print(f"⚠️ No parsing scheme specified, defaulting to {parsing_scheme}\n")

            if not raw_table_name:
                derived_scheme = 'BOG_GEL' if currency_code == 'GEL' else f"BOG_{currency_code}"
                raw_table_name = f'"{account_number}_{derived_scheme}"'
                print(f"⚠️ No raw_table_name configured, using derived table: {raw_table_name}\n")
            
            # Step 3: Process based on parsing scheme
            if parsing_scheme in ('BOG_GEL', 'BOG_USD', 'BOG_FX'):
                process_bog_gel(xml_file, account_uuid, account_number, currency_code, 
                              raw_table_name, supabase_conn, supabase_conn)
            else:
                print(f"❌ Unsupported parsing scheme: {parsing_scheme}")
                sys.exit(1)
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            supabase_cursor.close()
            supabase_conn.close()
    
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

