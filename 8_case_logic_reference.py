# Restructured 8-Case Processing Logic for import_bank_xml_data.py
# This shows the complete hierarchical logic that needs to be implemented

"""
8-CASE HIERARCHICAL PROCESSING LOGIC

Phase 1: Counteragent Identification (Cases 1, 2, 3)
├─ Case 1: counteragent_processed → INN matched in database → ASSIGN counteragent
├─ Case 2: counteragent_inn_blank → No INN in raw data → Try payment/rules
└─ Case 3: counteragent_inn_nonblank_no_match → INN exists but no DB match → Needs manual addition

Phase 2: Payment ID Matching (Cases 4, 5)
├─ Case 4: payment_id_match → Payment found AND counteragent matches Case 1 → ASSIGN payment parameters
└─ Case 5: payment_id_counteragent_mismatch → Payment found BUT conflicts with Case 1 → FLAG conflict

Phase 3: Parsing Rules (Cases 6, 7, 8) - HIGHEST PARAMETER PRIORITY
├─ Case 6: parsing_rule_match → Rule matched AND counteragent matches Case 1 → ASSIGN rule parameters
├─ Case 7: parsing_rule_counteragent_mismatch → Rule matched BUT conflicts with Case 1 → FLAG conflict
└─ Case 8: parsing_rule_dominance → Rule matched AND Case 4 exists → OVERRIDE payment parameters

HIERARCHY RULES:
1. Case 1 counteragent is IMMUTABLE (never override)
2. Case 8 (parsing rules) OVERRIDE Case 4 (payment) parameters
3. Only ONE counteragent case flag is TRUE (1, 2, or 3)
4. Multiple processing flags can be TRUE (e.g., Case 1 + Case 4 + Case 8)
"""

# Processing steps for each record:

# STEP 1: Initialize all 8 flags to False
case1_counteragent_processed = False
case2_counteragent_inn_blank = False
case3_counteragent_inn_nonblank_no_match = False
case4_payment_id_match = False
case5_payment_id_counteragent_mismatch = False
case6_parsing_rule_match = False
case7_parsing_rule_counteragent_mismatch = False
case8_parsing_rule_dominance = False

# STEP 2: Extract account number and INN
counteragent_account_number = DocCorAcct.strip() if DocCorAcct else None
is_incoming = (debit is None or debit == 0)

if is_incoming:
    counteragent_inn = normalize_inn(DocSenderInn)
    if not counteragent_account_number and DocSenderAcctNo:
        counteragent_account_number = DocSenderAcctNo.strip()
else:
    counteragent_inn = normalize_inn(DocBenefInn)
    if not counteragent_account_number and DocBenefAcctNo:
        counteragent_account_number = DocBenefAcctNo.strip()

# STEP 3: Process Phase 1 - Counteragent Identification
if counteragent_inn:
    counteragent_data = counteragents_map.get(counteragent_inn)
    if counteragent_data:
        # CASE 1: Counteragent matched
        case1_counteragent_processed = True
        counteragent_uuid = counteragent_data['uuid']
        print(f"✅ [CASE 1] Matched counteragent")
    else:
        # CASE 3: INN exists but no match
        case3_counteragent_inn_nonblank_no_match = True
        print(f"⚠️  [CASE 3] INN {counteragent_inn} needs counteragent")
else:
    # CASE 2: INN is blank
    case2_counteragent_inn_blank = True
    print(f"ℹ️  [CASE 2] INN blank")

# STEP 4: Process Phase 2 - Payment ID
payment_id = extract_payment_id(DocInformation)
payment_parameters = None  # Store payment-derived parameters

if payment_id:
    payment_data = payments_map.get(payment_id)
    if payment_data:
        payment_counteragent = payment_data.get('counteragent_uuid')
        payment_project = payment_data.get('project_uuid')
        payment_financial_code = payment_data.get('financial_code_uuid')
        payment_currency = payment_data.get('nominal_currency_uuid')
        
        if case1_counteragent_processed:
            # Case 1 exists - check if payment counteragent matches
            if payment_counteragent == counteragent_uuid:
                # CASE 4: Payment matches Case 1 counteragent
                case4_payment_id_match = True
                # Store payment parameters (may be overridden by Case 8)
                payment_parameters = {
                    'project_uuid': payment_project,
                    'financial_code_uuid': payment_financial_code,
                    'nominal_currency_uuid': payment_currency
                }
                # TEMPORARILY assign (may be overridden by parsing rules)
                project_uuid = payment_project
                financial_code_uuid = payment_financial_code
                nominal_currency_uuid = payment_currency
                print(f"✅ [CASE 4] Payment matches counteragent")
            else:
                # CASE 5: Payment conflicts with Case 1
                case5_payment_id_counteragent_mismatch = True
                print(f"⚠️  [CASE 5] Payment counteragent conflicts")
        
        elif case2_counteragent_inn_blank or case3_counteragent_inn_nonblank_no_match:
            # No Case 1 counteragent - payment can provide data
            if payment_counteragent:
                # Use payment counteragent for Cases 2 or 3
                counteragent_uuid = payment_counteragent
                case4_payment_id_match = True
                payment_parameters = {
                    'project_uuid': payment_project,
                    'financial_code_uuid': payment_financial_code,
                    'nominal_currency_uuid': payment_currency
                }
                project_uuid = payment_project
                financial_code_uuid = payment_financial_code
                nominal_currency_uuid = payment_currency
                print(f"✅ [CASE 4] Payment provides counteragent (Case 2/3)")

# STEP 5: Process Phase 3 - Parsing Rules (HIGHEST PRIORITY for parameters)
for rule in parsing_rules:
    column_name = rule.get('column_name')
    condition = rule.get('condition')
    
    # Match rule
    field_value = {
        'DocProdGroup': DocProdGroup,
        'DocNomination': DocNomination,
        'DocInformation': DocInformation,
    }.get(column_name)
    
    if field_value and str(field_value).strip() == str(condition).strip():
        # Rule matched
        rule_counteragent = rule.get('counteragent_uuid')
        rule_project = rule.get('project_uuid')
        rule_financial_code = rule.get('financial_code_uuid')
        rule_currency = rule.get('nominal_currency_uuid')
        
        if case1_counteragent_processed:
            # Case 1 exists - check if rule counteragent matches
            if rule_counteragent == counteragent_uuid or not rule_counteragent:
                # CASE 6: Rule matches Case 1 counteragent (or rule doesn't specify counteragent)
                case6_parsing_rule_match = True
                
                # CASE 8: Check if this overrides Case 4
                if case4_payment_id_match:
                    case8_parsing_rule_dominance = True
                    print(f"🎯 [CASE 8] Parsing rule OVERRIDES payment parameters")
                
                # ASSIGN rule parameters (HIGHEST PRIORITY)
                if rule_project:
                    project_uuid = rule_project
                if rule_financial_code:
                    financial_code_uuid = rule_financial_code
                if rule_currency:
                    nominal_currency_uuid = rule_currency
                
                print(f"✅ [CASE 6] Parsing rule applied")
                break  # Use first matching rule
            else:
                # CASE 7: Rule conflicts with Case 1
                case7_parsing_rule_counteragent_mismatch = True
                print(f"⚠️  [CASE 7] Parsing rule counteragent conflicts")
                break
        
        elif case2_counteragent_inn_blank or case3_counteragent_inn_nonblank_no_match:
            # No Case 1 counteragent - rule can provide data
            if rule_counteragent:
                counteragent_uuid = rule_counteragent
            
            case6_parsing_rule_match = True
            
            # Check Case 8 dominance
            if case4_payment_id_match:
                case8_parsing_rule_dominance = True
                print(f"🎯 [CASE 8] Parsing rule OVERRIDES payment (Case 2/3)")
            
            # ASSIGN rule parameters
            if rule_project:
                project_uuid = rule_project
            if rule_financial_code:
                financial_code_uuid = rule_financial_code
            if rule_currency:
                nominal_currency_uuid = rule_currency
            
            print(f"✅ [CASE 6] Parsing rule applied (Case 2/3)")
            break

# STEP 6: Store flags in raw_updates dictionary
raw_updates.append({
    'uuid': raw_uuid,
    'counteragent_processed': case1_counteragent_processed,
    'counteragent_inn_blank': case2_counteragent_inn_blank,
    'counteragent_inn_nonblank_no_match': case3_counteragent_inn_nonblank_no_match,
    'payment_id_match': case4_payment_id_match,
    'payment_id_counteragent_mismatch': case5_payment_id_counteragent_mismatch,
    'parsing_rule_match': case6_parsing_rule_match,
    'parsing_rule_counteragent_mismatch': case7_parsing_rule_counteragent_mismatch,
    'parsing_rule_dominance': case8_parsing_rule_dominance,
    'is_processed': True  # Mark as processed
})

# STEP 7: Create consolidated record with final parameters
consolidated_records.append({
    'uuid': raw_uuid,
    'counteragent_uuid': counteragent_uuid,
    'counteragent_account_number': counteragent_account_number,
    'project_uuid': project_uuid,
    'financial_code_uuid': financial_code_uuid,
    'nominal_currency_uuid': nominal_currency_uuid,
    # ... other fields
})
