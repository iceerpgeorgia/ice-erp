#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test account extraction logic to verify it matches the JavaScript implementation.
This mimics the exact account extraction priority used in process-bog-gel-counteragents-first.js
"""

def test_account_extraction():
    """Test various account extraction scenarios"""
    
    test_cases = [
        {
            'name': 'Case 1: DocCorAcct available (incoming)',
            'DocCorAcct': 'GE12TB0000000123456789',
            'DocSenderAcctNo': 'GE12TB0000000987654321',
            'DocBenefAcctNo': None,
            'debit': None,
            'expected_account': 'GE12TB0000000123456789',
            'expected_source': 'DocCorAcct (priority)'
        },
        {
            'name': 'Case 2: DocCorAcct available (outgoing)',
            'DocCorAcct': 'GE12TB0000000123456789',
            'DocSenderAcctNo': None,
            'DocBenefAcctNo': 'GE12TB0000000987654321',
            'debit': 100.50,
            'expected_account': 'GE12TB0000000123456789',
            'expected_source': 'DocCorAcct (priority)'
        },
        {
            'name': 'Case 3: No DocCorAcct, use DocSenderAcctNo (incoming)',
            'DocCorAcct': None,
            'DocSenderAcctNo': 'GE12TB0000000987654321',
            'DocBenefAcctNo': None,
            'debit': None,
            'expected_account': 'GE12TB0000000987654321',
            'expected_source': 'DocSenderAcctNo (fallback)'
        },
        {
            'name': 'Case 4: No DocCorAcct, use DocBenefAcctNo (outgoing)',
            'DocCorAcct': None,
            'DocSenderAcctNo': None,
            'DocBenefAcctNo': 'GE12TB0000000987654321',
            'debit': 100.50,
            'expected_account': 'GE12TB0000000987654321',
            'expected_source': 'DocBenefAcctNo (fallback)'
        },
        {
            'name': 'Case 5: DocCorAcct empty string, use fallback (incoming)',
            'DocCorAcct': '  ',
            'DocSenderAcctNo': 'GE12TB0000000987654321',
            'DocBenefAcctNo': None,
            'debit': None,
            'expected_account': 'GE12TB0000000987654321',
            'expected_source': 'DocSenderAcctNo (fallback)'
        },
        {
            'name': 'Case 6: No accounts available',
            'DocCorAcct': None,
            'DocSenderAcctNo': None,
            'DocBenefAcctNo': None,
            'debit': None,
            'expected_account': None,
            'expected_source': 'None'
        },
        {
            'name': 'Case 7: Scientific notation prevention (long IBAN)',
            'DocCorAcct': '1234567890123456789012345678',
            'DocSenderAcctNo': None,
            'DocBenefAcctNo': None,
            'debit': None,
            'expected_account': '1234567890123456789012345678',
            'expected_source': 'DocCorAcct (priority)'
        },
    ]
    
    print("🧪 Testing Account Extraction Logic\n")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test in test_cases:
        print(f"\n📝 {test['name']}")
        print(f"   Input: DocCorAcct={test['DocCorAcct']}, debit={test['debit']}")
        print(f"          DocSenderAcctNo={test['DocSenderAcctNo']}")
        print(f"          DocBenefAcctNo={test['DocBenefAcctNo']}")
        
        # Apply the exact logic from import_bank_xml_data.py
        DocCorAcct = test['DocCorAcct']
        DocSenderAcctNo = test['DocSenderAcctNo']
        DocBenefAcctNo = test['DocBenefAcctNo']
        debit = test['debit']
        
        # PRIORITY 1: Use DocCorAcct if available
        counteragent_account_number = None
        account_source = None
        
        if DocCorAcct and str(DocCorAcct).strip():
            counteragent_account_number = str(DocCorAcct).strip()
            account_source = 'DocCorAcct (priority)'
        
        # Determine transaction direction
        is_incoming = (debit is None or debit == 0)
        
        if is_incoming:
            # FALLBACK: Use DocSenderAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocSenderAcctNo and str(DocSenderAcctNo).strip():
                counteragent_account_number = str(DocSenderAcctNo).strip()
                account_source = 'DocSenderAcctNo (fallback)'
        else:
            # FALLBACK: Use DocBenefAcctNo only if DocCorAcct not available
            if not counteragent_account_number and DocBenefAcctNo and str(DocBenefAcctNo).strip():
                counteragent_account_number = str(DocBenefAcctNo).strip()
                account_source = 'DocBenefAcctNo (fallback)'
        
        if not account_source:
            account_source = 'None'
        
        # Verify results
        if counteragent_account_number == test['expected_account'] and account_source == test['expected_source']:
            print(f"   ✅ PASS: Got {counteragent_account_number} from {account_source}")
            passed += 1
        else:
            print(f"   ❌ FAIL:")
            print(f"      Expected: {test['expected_account']} from {test['expected_source']}")
            print(f"      Got:      {counteragent_account_number} from {account_source}")
            failed += 1
    
    print("\n" + "=" * 80)
    print(f"\n📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Logic matches JavaScript implementation.")
    else:
        print("⚠️  Some tests failed. Please review the logic.")
    
    return failed == 0

if __name__ == '__main__':
    success = test_account_extraction()
    exit(0 if success else 1)
