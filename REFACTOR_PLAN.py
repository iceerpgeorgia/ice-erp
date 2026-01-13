"""
Refactored BOG GEL processing - uses shared process_single_record function
This will replace the duplicate code in both process_bog_gel and backparse_bog_gel
"""

# The processing loop for both functions becomes:
for idx, raw_record in enumerate(raw_records, 1):
    # Extract raw fields into a dict
    row = {
        'uuid': raw_record[0],
        'dockey': raw_record[1],
        'entriesid': raw_record[2],
        'docrecdate': raw_record[3],
        'docvaluedate': raw_record[4],
        'entrycr': raw_record[5],
        'entrydb': raw_record[6],
        'docsenderinn': raw_record[7],
        'docbenefinn': raw_record[8],
        'docsenderacctno': raw_record[9],
        'docbenefacctno': raw_record[10],
        'doccorracct': raw_record[11],
        'docnomination': raw_record[12],
        'docinformation': raw_record[13],
        'docprodgroup': raw_record[14],
        'debit': Decimal(raw_record[6]) if raw_record[6] else Decimal('0')
    }
    
    # Calculate amounts
    credit = Decimal(row['entrycr']) if row['entrycr'] else Decimal('0')
    debit = Decimal(row['entrydb']) if row['entrydb'] else Decimal('0')
    account_currency_amount = credit - debit
    
    # Parse dates
    transaction_date = parse_bog_date(row['docvaluedate'])
    correction_date = parse_bog_date(row['docrecdate'])
    
    if not transaction_date:
        continue
    
    # ===== CALL SHARED PROCESSING FUNCTION =====
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
    nominal_amount = account_currency_amount  # For now, same as account currency
    
    # Generate case description
    case_description = compute_case_description(
        result['case1_counteragent_processed'],
        False,  # case2 merged into case1_counteragent_processed
        result['case3_counteragent_missing'],
        result['case4_payment_id_matched'],
        result['case5_payment_id_conflict'],
        result['case6_parsing_rule_applied'],
        result['case7_parsing_rule_conflict'],
        False   # case8 removed - merged into other logic
    )
    
    # Prepare consolidated record
    consolidated_records.append({
        'uuid': row['uuid'],
        'account_uuid': account_uuid,
        'counteragent_uuid': result['counteragent_uuid'],
        'counteragent_account_number': result['counteragent_account_number'],
        'transaction_date': transaction_date,
        'correction_date': correction_date,
        'description': row['docnomination'],
        'payment_id': result['payment_id'],
        'project_uuid': result['project_uuid'],
        'financial_code_uuid': result['financial_code_uuid'],
        'account_currency_uuid': account_currency_uuid,
        'account_currency_amount': float(account_currency_amount),
        'nominal_currency_uuid': nominal_currency_uuid,
        'nominal_amount': float(nominal_amount),
        'processing_case': case_description
    })
    
    # Prepare raw table update
    raw_updates.append({
        'uuid': row['uuid'],
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
