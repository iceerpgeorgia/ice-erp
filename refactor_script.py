"""
Full refactoring script to use shared process_single_record() function
This replaces the duplicate processing logic in both process_bog_gel and backparse_bog_gel
"""

with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# The shared processing loop code that both functions will use
shared_loop = '''        raw_uuid = raw_record[0]
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
        
        # Prepare row dict for shared function
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
        
        # Set defaults for missing values
        nominal_currency_uuid = result['nominal_currency_uuid'] or account_currency_uuid
        nominal_amount = account_currency_amount
        
        # Generate case description (case2 and case8 deprecated, set to False)
        case_description = compute_case_description(
            result['case1_counteragent_processed'],
            False,  # case2 merged into case1
            result['case3_counteragent_missing'],
            result['case4_payment_id_matched'],
            result['case5_payment_id_conflict'],
            result['case6_parsing_rule_applied'],
            result['case7_parsing_rule_conflict'],
            False   # case8 merged into other flags
        )
        
        # Prepare consolidated record
        consolidated_records.append({
            'uuid': raw_uuid,
            'account_uuid': account_uuid,
            'counteragent_uuid': result['counteragent_uuid'],
            'counteragent_account_number': result['counteragent_account_number'],
            'transaction_date': transaction_date,
            'correction_date': correction_date,
            'description': DocNomination,
            'payment_id': result['payment_id'],
            'project_uuid': result['project_uuid'],
            'financial_code_uuid': result['financial_code_uuid'],
            'account_currency_uuid': account_currency_uuid,
            'account_currency_amount': float(account_currency_amount),
            'nominal_currency_uuid': nominal_currency_uuid,
            'nominal_amount': float(nominal_amount),
            'processing_case': case_description
        })
        
        # Prepare raw table update with correct Supabase column names
        raw_updates.append({
            'uuid': raw_uuid,
            'counteragent_processed': result['case1_counteragent_processed'],
            'counteragent_found': result['case1_counteragent_found'],
            'counteragent_missing': result['case3_counteragent_missing'],
            'payment_id_matched': result['case4_payment_id_matched'],
            'payment_id_conflict': result['case5_payment_id_conflict'],
            'parsing_rule_applied': result['case6_parsing_rule_applied'],
            'parsing_rule_conflict': result['case7_parsing_rule_conflict'],
            'counteragent_inn': result['counteragent_inn'],
            'processing_case': case_description
        })
'''

print("✅ Refactoring plan ready")
print("\nThis will:")
print("  1. Replace duplicate code in process_bog_gel")
print("  2. Replace duplicate code in backparse_bog_gel") 
print("  3. Both will use process_single_record()")
print("  4. All column names will be consistent")
print("\nReady to apply? (This script just shows the plan)")
