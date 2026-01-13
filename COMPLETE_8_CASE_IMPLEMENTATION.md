# Complete 8-Case Implementation for import_bank_xml_data.py

## This document shows all changes needed for both process_bog_gel() and backparse_bog_gel()

---

## SECTION 1: Initialize 8 Case Flags (Replace in BOTH functions)

### OLD CODE (lines ~469-480 and ~1104-1115):
```python
        counteragent_processed = False
        parsing_rule_processed = False
        payment_id_processed = False
        
        parsing_rule_conflict = False
        payment_conflict = False
```

### NEW CODE:
```python
        # Initialize 8-case flags (mutually exclusive for Cases 1/2/3)
        case1_counteragent_processed = False
        case2_counteragent_inn_blank = False
        case3_counteragent_inn_nonblank_no_match = False
        case4_payment_id_match = False
        case5_payment_id_counteragent_mismatch = False
        case6_parsing_rule_match = False
        case7_parsing_rule_counteragent_mismatch = False
        case8_parsing_rule_dominance = False
```

---

## SECTION 2: Phase 1 Logic (Replace in BOTH functions)

### OLD CODE (lines ~510-550):
```python
        if counteragent_inn:
            counteragent_data = counteragents_map.get(counteragent_inn)
            if counteragent_data:
                counteragent_uuid = counteragent_data['uuid']
                counteragent_processed = True
                stats['case1_matched'] += 1
            else:
                counteragent_processed = False
                stats['case2_inn_no_counteragent'] += 1
        else:
            counteragent_processed = False
            stats['case3_no_inn'] += 1
```

### NEW CODE:
```python
        # Process Cases 1, 2, 3 (mutually exclusive)
        if counteragent_inn:
            counteragent_data = counteragents_map.get(counteragent_inn)
            if counteragent_data:
                # CASE 1: Counteragent matched by INN
                counteragent_uuid = counteragent_data['uuid']
                case1_counteragent_processed = True
                stats['case1_counteragent_processed'] += 1
               if idx <= 3:
                    print(f"  ✅ [CASE 1] Matched counteragent {counteragent_data['name']}")
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
                    print(f"  ⚠️  [CASE 3] INN {counteragent_inn} needs counteragent")
        else:
            # CASE 2: INN is blank
            case2_counteragent_inn_blank = True
            stats['case2_counteragent_inn_blank'] += 1
            
            if idx <= 3:
                print(f"  ℹ️  [CASE 2] INN blank - will try payment/rules")
```

---

## SECTION 3: Phase 2 - Payment ID Logic (INSERT BEFORE Phase 3)

### NEW CODE TO ADD:
```python
        # =============================
        # PHASE 2: Payment ID Matching (Cases 4, 5)
        # =============================
        
        payment_id = extract_payment_id(DocInformation)
        payment_project = None
        payment_financial_code = None
        payment_currency = None
        
        if payment_id:
            payment_data = payments_map.get(payment_id)
            if payment_data:
                payment_counteragent = payment_data.get('counteragent_uuid')
                payment_project = payment_data.get('project_uuid')
                payment_financial_code = payment_data.get('financial_code_uuid')
                payment_currency = payment_data.get('nominal_currency_uuid')
                
                if case1_counteragent_processed:
                    # Case 1 exists - check if payment counteragent matches
                    if payment_counteragent == counteragent_uuid or not payment_counteragent:
                        # CASE 4: Payment matches Case 1 counteragent
                        case4_payment_id_match = True
                        stats['case4_payment_id_match'] += 1
                        # Temporarily assign (may be overridden by Case 8)
                        if not project_uuid and payment_project:
                            project_uuid = payment_project
                        if not financial_code_uuid and payment_financial_code:
                            financial_code_uuid = payment_financial_code
                        if payment_currency:
                            nominal_currency_uuid = payment_currency
                        
                        if idx <= 3:
                            print(f"    ✅ [CASE 4] Payment {payment_id} matches")
                    else:
                        # CASE 5: Payment conflicts with Case 1
                        case5_payment_id_counteragent_mismatch = True
                        stats['case5_payment_id_counteragent_mismatch'] += 1
                        if idx <= 3:
                            print(f"    ⚠️  [CASE 5] Payment counteragent conflicts")
                
                elif case2_counteragent_inn_blank or case3_counteragent_inn_nonblank_no_match:
                    # No Case 1 - payment can provide counteragent
                    if payment_counteragent:
                        counteragent_uuid = payment_counteragent
                    case4_payment_id_match = True
                    stats['case4_payment_id_match'] += 1
                    if payment_project:
                        project_uuid = payment_project
                    if payment_financial_code:
                        financial_code_uuid = payment_financial_code
                    if payment_currency:
                        nominal_currency_uuid = payment_currency
                    
                    if idx <= 3:
                        print(f"    ✅ [CASE 4] Payment provides data (Case 2/3)")
```

---

## SECTION 4: Phase 3 - Parsing Rules with Case 8 Logic (REPLACE existing Phase 2)

### NEW CODE:
```python
        # =============================
        # PHASE 3: Parsing Rules (Cases 6, 7, 8) - HIGHEST PRIORITY
        # =============================
        
        matched_rule = None
        for rule in parsing_rules:
            column_name = rule.get('column_name', '')
            condition = rule.get('condition', '')
            
            if not column_name or not condition:
                continue
            
            # Match rule
            field_map = {
                'DocProdGroup': DocProdGroup,
                'DocNomination': DocNomination,
                'DocInformation': DocInformation,
                'DocKey': DocKey,
            }
            
            field_value = field_map.get(column_name)
            if field_value and str(field_value).strip() == str(condition).strip():
                # Rule matched
                rule_counteragent = rule.get('counteragent_uuid')
                rule_project = rule.get('project_uuid')
                rule_financial_code = rule.get('financial_code_uuid')
                rule_currency = rule.get('nominal_currency_uuid')
                
                if case1_counteragent_processed:
                    # Case 1 exists - check if rule counteragent matches
                    if rule_counteragent == counteragent_uuid or not rule_counteragent:
                        # CASE 6: Rule matches Case 1
                        case6_parsing_rule_match = True
                        stats['case6_parsing_rule_match'] += 1
                        
                        # CASE 8: Check if this overrides Case 4
                        if case4_payment_id_match and (rule_project or rule_financial_code or rule_currency):
                            case8_parsing_rule_dominance = True
                            stats['case8_parsing_rule_dominance'] += 1
                            if idx <= 3:
                                print(f"      🎯 [CASE 8] Rule OVERRIDES payment")
                        
                        # ASSIGN rule parameters (HIGHEST PRIORITY)
                        if rule_project:
                            project_uuid = rule_project
                        if rule_financial_code:
                            financial_code_uuid = rule_financial_code
                        if rule_currency:
                            nominal_currency_uuid = rule_currency
                        
                        if idx <= 3:
                            print(f"    🎯 [CASE 6] Rule applied")
                        break
                    else:
                        # CASE 7: Rule conflicts with Case 1
                        case7_parsing_rule_counteragent_mismatch = True
                        stats['case7_parsing_rule_counteragent_mismatch'] += 1
                        if idx <= 3:
                            print(f"    ⚠️  [CASE 7] Rule counteragent conflicts")
                        break
                
                elif case2_counteragent_inn_blank or case3_counteragent_inn_nonblank_no_match:
                    # No Case 1 - rule can provide counteragent
                    if rule_counteragent:
                        counteragent_uuid = rule_counteragent
                    
                    case6_parsing_rule_match = True
                    stats['case6_parsing_rule_match'] += 1
                    
                    # Check Case 8 dominance
                    if case4_payment_id_match and (rule_project or rule_financial_code or rule_currency):
                        case8_parsing_rule_dominance = True
                        stats['case8_parsing_rule_dominance'] += 1
                        if idx <= 3:
                            print(f"      🎯 [CASE 8] Rule OVERRIDES payment (Case 2/3)")
                    
                    # ASSIGN rule parameters
                    if rule_project:
                        project_uuid = rule_project
                    if rule_financial_code:
                        financial_code_uuid = rule_financial_code
                    if rule_currency:
                        nominal_currency_uuid = rule_currency
                    
                    if idx <= 3:
                        print(f"    🎯 [CASE 6] Rule applied (Case 2/3)")
                    break
```

---

## SECTION 5: Raw Table UPDATE Query (Replace in BOTH functions)

### OLD CODE (lines ~751-757):
```python
        update_raw_query = f"""
            UPDATE {raw_table_name} SET
                counteragent_processed = %(counteragent_processed)s,
                parsing_rule_processed = %(parsing_rule_processed)s,
                payment_id_processed = %(payment_id_processed)s,
                is_processed = %(is_processed)s,
                counteragent_inn = %(counteragent_inn)s
            WHERE uuid = %(uuid)s
        """
```

### NEW CODE:
```python
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
```

---

## SECTION 6: raw_updates.append() (Replace in BOTH functions)

### OLD CODE:
```python
        raw_updates.append({
            'uuid': raw_uuid,
            'counteragent_processed': counteragent_processed,
            'parsing_rule_processed': parsing_rule_processed,
            'payment_id_processed': payment_id_processed,
            'is_processed': is_fully_processed,
            'counteragent_inn': counteragent_inn
        })
```

### NEW CODE:
```python
        raw_updates.append({
            'uuid': raw_uuid,
            'case1_counteragent_processed': case1_counteragent_processed,
            'case2_counteragent_inn_blank': case2_counteragent_inn_blank,
            'case3_counteragent_inn_nonblank_no_match': case3_counteragent_inn_nonblank_no_match,
            'case4_payment_id_match': case4_payment_id_match,
            'case5_payment_id_counteragent_mismatch': case5_payment_id_counteragent_mismatch,
            'case6_parsing_rule_match': case6_parsing_rule_match,
            'case7_parsing_rule_counteragent_mismatch': case7_parsing_rule_counteragent_mismatch,
            'case8_parsing_rule_dominance': case8_parsing_rule_dominance,
        })
```

---

## SECTION 7: Summary Output (Replace in BOTH functions)

### OLD CODE:
```python
    print(f"📋 Phase 1 - Counteragent Identification:")
    print(f"  ✅ Case 1 (INN matched): {stats['case1_matched']}")
    print(f"  ⚠️  Case 2 (INN needs counteragent): {stats['case2_inn_no_counteragent']}")
    print(f"  ℹ️  Case 3 (No INN): {stats['case3_no_inn']}\n")
    
    print(f"📋 Phase 2 - Parsing Rules:")
    print(f"  ✅ Rules applied: {stats['parsing_rule_applied']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['parsing_rule_conflicts']}\n")
    
    print(f"📋 Phase 3 - Payment ID:")
    print(f"  ✅ Payment matched: {stats['payment_id_matched']}")
    print(f"  ⚠️  Conflicts (kept counteragent): {stats['payment_id_conflicts']}\n")
```

### NEW CODE:
```python
    print(f"📋 Phase 1 - Counteragent Identification:")
    print(f"  ✅ Case 1 (Counteragent matched): {stats['case1_counteragent_processed']}")
    print(f"  ℹ️  Case 2 (INN blank): {stats['case2_counteragent_inn_blank']}")
    print(f"  ⚠️  Case 3 (INN no match): {stats['case3_counteragent_inn_nonblank_no_match']}\n")
    
    print(f"📋 Phase 2 - Payment ID Matching:")
    print(f"  ✅ Case 4 (Payment match): {stats['case4_payment_id_match']}")
    print(f"  ⚠️  Case 5 (Payment conflict): {stats['case5_payment_id_counteragent_mismatch']}\n")
    
    print(f"📋 Phase 3 - Parsing Rules (HIGHEST PRIORITY):")
    print(f"  ✅ Case 6 (Rule match): {stats['case6_parsing_rule_match']}")
    print(f"  ⚠️  Case 7 (Rule conflict): {stats['case7_parsing_rule_counteragent_mismatch']}")
    print(f"  🎯 Case 8 (Rule dominance): {stats['case8_parsing_rule_dominance']}\n")
```

---

## APPLY ORDER:

1. Section 1: Initialize flags (2 locations)
2. Section 2: Phase 1 logic (2 locations)
3. Section 3: INSERT Phase 2 - Payment ID (2 locations)
4. Section 4: REPLACE Phase 3 - Parsing Rules (2 locations)  
5. Section 5: UPDATE query (2 locations)
6. Section 6: raw_updates.append (2 locations)
7. Section 7: Summary output (2 locations)

Total: 14 edits across 2 functions
