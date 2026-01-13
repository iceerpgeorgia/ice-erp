#!/usr/bin/env python3
"""
Reparse BOG GEL data in Supabase: read from raw tables, process with three-phase hierarchy, 
write to consolidated_bank_accounts table.

This script processes existing Supabase raw data with the full 8-case hierarchical logic
including payment_id support from parsing rules.
"""

import psycopg2
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Connection strings
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')

# Parse Supabase connection from URL
# Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SUPABASE_DB_URL = os.getenv('DATABASE_URL')  # This should be the direct Postgres URL


def generate_case_description(case1, case2, case3, case4, case5, case6, case7, case8):
    """
    Generate multi-line case description using \n separator (Excel CHAR(10))
    """
    cases = []
    if case1:
        cases.append("Case1: Counteragent found by INN (processed)")
    if case2:
        cases.append("Case2: INN found but counteragent missing from database")
    if case3:
        cases.append("Case3: No INN in raw data")
    if case4:
        cases.append("Case4: Payment ID matched successfully")
    if case5:
        cases.append("Case5: Payment ID extracted but not found in database")
    if case6:
        cases.append("Case6: Parsing rule matched with no conflicts")
    if case7:
        cases.append("Case7: Parsing rule matched but counteragent conflict detected")
    if case8:
        cases.append("Case8: Parsing rule parameters overrode payment parameters (rule dominance)")
    
    return "\n".join(cases) if cases else ""


def reparse_supabase_bog_gel(account_uuid=None, batch_id=None, clear_first=False):
    """
    Reparse existing BOG GEL raw data in Supabase and write consolidated records back to Supabase.
    
    Args:
        account_uuid: Filter by specific bank_account_uuid (optional)
        batch_id: Filter by specific batch_id (optional)
        clear_first: If True, delete existing consolidated records before reparsing
    """
    
    print(f"\n{'='*80}")
    print(f"🔄 SUPABASE BOG GEL REPARSE - Three-Phase Hierarchy")
    print(f"{'='*80}\n")
    
    start_time = datetime.now()
    
    # Connect to Supabase
    try:
        supabase_conn = psycopg2.connect(SUPABASE_DB_URL)
        supabase_cursor = supabase_conn.cursor()
        print("✅ Connected to Supabase\n")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    try:
        # Find raw tables
        supabase_cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'bog_gel_raw_%'
            ORDER BY table_name
        """)
        
        raw_tables = [row[0] for row in supabase_cursor.fetchall()]
        
        if not raw_tables:
            print("❌ No BOG GEL raw tables found in Supabase")
            return
        
        print(f"📊 Found {len(raw_tables)} raw tables:")
        for table in raw_tables:
            supabase_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = supabase_cursor.fetchone()[0]
            print(f"   - {table}: {count:,} records")
        print()
        
        # Optional: Clear consolidated records first
        if clear_first:
            if account_uuid:
                supabase_cursor.execute("""
                    DELETE FROM consolidated_bank_accounts 
                    WHERE bank_account_uuid = %s
                """, (account_uuid,))
                deleted = supabase_cursor.rowcount
                print(f"🗑️  Deleted {deleted:,} consolidated records for account {account_uuid}\n")
            else:
                supabase_cursor.execute("DELETE FROM consolidated_bank_accounts")
                deleted = supabase_cursor.rowcount
                print(f"🗑️  Deleted {deleted:,} consolidated records (full clear)\n")
            supabase_conn.commit()
        
        # Load dictionaries from Supabase
        print("📚 Loading dictionaries from Supabase...")
        
        # Load counteragents
        supabase_cursor.execute("""
            SELECT inn, uuid, name 
            FROM counteragents 
            WHERE inn IS NOT NULL
        """)
        counteragents_map = {}
        for inn, uuid, name in supabase_cursor.fetchall():
            normalized_inn = inn.zfill(11) if len(inn) == 10 else inn
            counteragents_map[normalized_inn] = {
                'uuid': uuid,
                'name': name
            }
        print(f"   ✓ Loaded {len(counteragents_map):,} counteragents")
        
        # Load parsing rules with payment_id support
        supabase_cursor.execute("""
            SELECT id, counteragent_uuid, financial_code_uuid, 
                   nominal_currency_uuid, payment_id,
                   column_name, condition
            FROM parsing_scheme_rules
            WHERE active = true
        """)
        parsing_rules = []
        for row in supabase_cursor.fetchall():
            parsing_rules.append({
                'id': row[0],
                'counteragent_uuid': row[1],
                'financial_code_uuid': row[2],
                'nominal_currency_uuid': row[3],
                'payment_id': row[4],
                'column_name': row[5],
                'condition': row[6]
            })
        print(f"   ✓ Loaded {len(parsing_rules):,} parsing rules")
        
        # Load payments
        supabase_cursor.execute("""
            SELECT payment_id, counteragent_uuid, project_uuid, 
                   financial_code_uuid, currency_uuid
            FROM payments
            WHERE payment_id IS NOT NULL
        """)
        payments_map = {}
        for payment_id, ca_uuid, proj_uuid, fc_uuid, curr_uuid in supabase_cursor.fetchall():
            payments_map[payment_id] = {
                'counteragent_uuid': ca_uuid,
                'project_uuid': proj_uuid,
                'financial_code_uuid': fc_uuid,
                'currency_uuid': curr_uuid
            }
        print(f"   ✓ Loaded {len(payments_map):,} payments\n")
        
        # Process each raw table
        total_processed = 0
        total_consolidated = 0
        
        for raw_table_name in raw_tables:
            print(f"{'─'*80}")
            print(f"📦 Processing table: {raw_table_name}")
            print(f"{'─'*80}\n")
            
            # Extract account UUID from table name
            acc_uuid = raw_table_name.replace('bog_gel_raw_', '')
            
            # Filter conditions
            where_clauses = []
            params = []
            
            if account_uuid:
                if acc_uuid != account_uuid:
                    print(f"⏭️  Skipping table (doesn't match filter: {account_uuid})\n")
                    continue
            
            if batch_id:
                where_clauses.append("batch_id = %s")
                params.append(batch_id)
            
            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
            
            # Get raw records
            query = f"""
                SELECT uuid, doc_key, entries_id, doc_date, doc_num, doc_information,
                       doc_corr_acct, doc_sender_inn, doc_benef_inn,
                       doc_sender_acct_no, doc_benef_acct_no, doc_prod_group,
                       debit, credit, narrative,
                       counteragent_processed, counteragent_inn,
                       parsing_rule_processed, payment_id_processed,
                       batch_id, imported_at
                FROM {raw_table_name}
                {where_sql}
            """
            
            supabase_cursor.execute(query, params)
            raw_records = supabase_cursor.fetchall()
            
            if not raw_records:
                print(f"⚠️  No records to process in {raw_table_name}\n")
                continue
            
            print(f"🔄 Processing {len(raw_records):,} raw records...")
            
            consolidated_records = []
            
            # Reset processing flags
            reset_query = f"""
                UPDATE {raw_table_name}
                SET is_processed = FALSE,
                    counteragent_processed = FALSE,
                    parsing_rule_processed = FALSE,
                    payment_id_processed = FALSE
                {where_sql}
            """
            supabase_cursor.execute(reset_query, params)
            supabase_conn.commit()
            
            for raw in raw_records:
                (uuid, doc_key, entries_id, doc_date, doc_num, doc_information,
                 doc_corr_acct, doc_sender_inn, doc_benef_inn,
                 doc_sender_acct_no, doc_benef_acct_no, doc_prod_group,
                 debit, credit, narrative,
                 counteragent_processed, counteragent_inn,
                 parsing_rule_processed, payment_id_processed,
                 batch_id, imported_at) = raw
                
                # Initialize all variables
                counteragent_uuid = None
                counteragent_name = None
                counteragent_account = None
                project_uuid = None
                financial_code_uuid = None
                currency_uuid = None
                extracted_payment_id = None
                
                # Initialize case flags
                case1 = case2 = case3 = case4 = case5 = case6 = case7 = case8 = False
                
                # ===================
                # PHASE 1: Counteragent Identification
                # ===================
                
                # Determine INN based on direction
                if debit is None or float(debit or 0) == 0:
                    # Incoming payment: use sender INN
                    raw_inn = doc_sender_inn
                else:
                    # Outgoing payment: use beneficiary INN
                    raw_inn = doc_benef_inn
                
                # Normalize INN
                if raw_inn:
                    normalized_inn = raw_inn.zfill(11) if len(raw_inn) == 10 else raw_inn
                    
                    if normalized_inn in counteragents_map:
                        # Case 1: Counteragent found
                        counteragent_uuid = counteragents_map[normalized_inn]['uuid']
                        counteragent_name = counteragents_map[normalized_inn]['name']
                        case1 = True
                        counteragent_processed = True
                    else:
                        # Case 2: INN found but counteragent missing
                        case2 = True
                        counteragent_processed = False
                    
                    counteragent_inn = normalized_inn
                else:
                    # Case 3: No INN in raw data
                    case3 = True
                    counteragent_processed = False
                    counteragent_inn = None
                
                # Extract counteragent account
                if doc_corr_acct:
                    counteragent_account = doc_corr_acct
                elif debit is None or float(debit or 0) == 0:
                    counteragent_account = doc_sender_acct_no
                else:
                    counteragent_account = doc_benef_acct_no
                
                # ===================
                # PHASE 2: Parsing Rules Application
                # ===================
                
                matched_rule = None
                for rule in parsing_rules:
                    column_name = rule['column_name']
                    condition = rule['condition']
                    
                    # Evaluate condition
                    field_value = None
                    if column_name == 'DocProdGroup':
                        field_value = doc_prod_group
                    # Add more column mappings as needed
                    
                    if field_value and field_value == condition:
                        matched_rule = rule
                        break
                
                if matched_rule:
                    # Check if rule has payment_id
                    rule_payment_id = matched_rule.get('payment_id')
                    if rule_payment_id and rule_payment_id in payments_map:
                        # Rule provides payment_id - lookup payment data
                        rule_payment_data = payments_map[rule_payment_id]
                        
                        # Check for counteragent conflict
                        rule_counteragent = rule_payment_data.get('counteragent_uuid')
                        if counteragent_uuid and rule_counteragent and counteragent_uuid != rule_counteragent:
                            # Case 7: Rule conflict - keep Phase 1 counteragent
                            case7 = True
                        else:
                            # Case 6: Rule matched with no conflict
                            case6 = True
                        
                        # Apply payment data from rule (but never override Phase 1 counteragent)
                        if not project_uuid:
                            project_uuid = rule_payment_data.get('project_uuid')
                        if not financial_code_uuid:
                            financial_code_uuid = rule_payment_data.get('financial_code_uuid')
                        if not currency_uuid:
                            currency_uuid = rule_payment_data.get('currency_uuid')
                    
                    else:
                        # Rule provides direct parameters
                        if not counteragent_uuid and matched_rule.get('counteragent_uuid'):
                            counteragent_uuid = matched_rule['counteragent_uuid']
                            case6 = True
                        elif counteragent_uuid and matched_rule.get('counteragent_uuid') and counteragent_uuid != matched_rule['counteragent_uuid']:
                            case7 = True
                        else:
                            case6 = True
                        
                        if not financial_code_uuid:
                            financial_code_uuid = matched_rule.get('financial_code_uuid')
                        if not currency_uuid:
                            currency_uuid = matched_rule.get('nominal_currency_uuid')
                    
                    parsing_rule_processed = True
                else:
                    parsing_rule_processed = False
                
                # ===================
                # PHASE 3: Payment ID Matching
                # ===================
                
                # Extract payment_id from DocInformation
                if doc_information:
                    import re
                    patterns = [
                        r'პი:\s*([^\s,;]+)',
                        r'PI:\s*([^\s,;]+)',
                        r'Payment ID:\s*([^\s,;]+)',
                        r'payment_id:\s*([^\s,;]+)',
                        r'\b([0-9a-f]{6}_[0-9a-f]{2}_[0-9a-fA-F]{6})\b'
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, doc_information, re.IGNORECASE)
                        if match:
                            extracted_payment_id = match.group(1)
                            break
                
                if extracted_payment_id and extracted_payment_id in payments_map:
                    payment_data = payments_map[extracted_payment_id]
                    
                    # Detect Case 8: Rule dominance over payment
                    rule_dominated = False
                    if parsing_rule_processed:
                        # Check if rule provides conflicting parameters
                        if (financial_code_uuid and payment_data.get('financial_code_uuid') and 
                            financial_code_uuid != payment_data['financial_code_uuid']):
                            rule_dominated = True
                        if (currency_uuid and payment_data.get('currency_uuid') and 
                            currency_uuid != payment_data['currency_uuid']):
                            rule_dominated = True
                        if (project_uuid and payment_data.get('project_uuid') and 
                            project_uuid != payment_data['project_uuid']):
                            rule_dominated = True
                    
                    if rule_dominated:
                        # Case 8: Rule parameters override payment parameters
                        case8 = True
                        # Keep rule parameters, don't apply payment data
                    else:
                        # Check for counteragent conflict
                        payment_counteragent = payment_data.get('counteragent_uuid')
                        if counteragent_uuid and payment_counteragent and counteragent_uuid != payment_counteragent:
                            # Case 5: Payment conflict - keep Phase 1 counteragent
                            case5 = True
                        else:
                            # Case 4: Payment matched successfully
                            case4 = True
                        
                        # Apply payment data (but never override Phase 1 counteragent or Phase 2 rule parameters)
                        if not counteragent_uuid:
                            counteragent_uuid = payment_data.get('counteragent_uuid')
                        if not project_uuid:
                            project_uuid = payment_data.get('project_uuid')
                        if not financial_code_uuid:
                            financial_code_uuid = payment_data.get('financial_code_uuid')
                        if not currency_uuid:
                            currency_uuid = payment_data.get('currency_uuid')
                    
                    payment_id_processed = True
                elif extracted_payment_id:
                    # Case 5: Payment ID extracted but not found
                    case5 = True
                    payment_id_processed = False
                else:
                    payment_id_processed = False
                
                # Generate case description
                case_description = generate_case_description(
                    case1, case2, case3, case4, case5, case6, case7, case8
                )
                
                # Create consolidated record
                consolidated_records.append((
                    uuid,  # uuid
                    acc_uuid,  # bank_account_uuid
                    doc_date,  # transaction_date
                    debit,  # debit
                    credit,  # credit
                    narrative,  # description
                    counteragent_uuid,  # counteragent_uuid
                    counteragent_name,  # counteragent_name
                    counteragent_account,  # counteragent_account
                    project_uuid,  # project_uuid
                    financial_code_uuid,  # financial_code_uuid
                    currency_uuid,  # currency_uuid
                    doc_key,  # doc_key
                    entries_id,  # entries_id
                    extracted_payment_id,  # payment_id
                    batch_id,  # batch_id
                    imported_at,  # imported_at
                    case_description,  # processing_case
                    datetime.now()  # processed_at
                ))
            
            # Bulk insert consolidated records to Supabase
            if consolidated_records:
                print(f"💾 Inserting {len(consolidated_records):,} consolidated records to Supabase...")
                
                insert_query = """
                    INSERT INTO consolidated_bank_accounts (
                        uuid, bank_account_uuid, transaction_date,
                        debit, credit, description,
                        counteragent_uuid, counteragent_name, counteragent_account,
                        project_uuid, financial_code_uuid, currency_uuid,
                        doc_key, entries_id, payment_id,
                        batch_id, imported_at, processing_case, processed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                supabase_cursor.executemany(insert_query, consolidated_records)
                supabase_conn.commit()
                
                total_consolidated += len(consolidated_records)
                print(f"✅ Inserted {len(consolidated_records):,} records\n")
            
            # Update processing flags in raw table
            update_query = f"""
                UPDATE {raw_table_name}
                SET is_processed = TRUE
                {where_sql}
            """
            supabase_cursor.execute(update_query, params)
            supabase_conn.commit()
            
            total_processed += len(raw_records)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n{'='*80}")
        print(f"✅ SUPABASE REPARSE COMPLETE")
        print(f"{'='*80}")
        print(f"📊 Total raw records processed: {total_processed:,}")
        print(f"💾 Total consolidated records created: {total_consolidated:,}")
        print(f"⏱️  Duration: {duration:.2f} seconds")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\n❌ Error during Supabase reparse: {e}")
        import traceback
        traceback.print_exc()
        supabase_conn.rollback()
    finally:
        supabase_cursor.close()
        supabase_conn.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Reparse BOG GEL data in Supabase')
    parser.add_argument('--account-uuid', help='Filter by specific bank account UUID')
    parser.add_argument('--batch-id', help='Filter by specific batch ID')
    parser.add_argument('--clear', action='store_true', 
                       help='Clear existing consolidated records before reparsing')
    
    args = parser.parse_args()
    
    reparse_supabase_bog_gel(
        account_uuid=args.account_uuid,
        batch_id=args.batch_id,
        clear_first=args.clear
    )
