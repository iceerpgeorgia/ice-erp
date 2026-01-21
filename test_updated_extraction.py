"""Test updated payment ID extraction function"""
import re

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
    match = re.search(r'NP_[A-F0-9a-f]{6}_NJ_[A-F0-9a-f]{6}_PRL\d{6}', text, re.IGNORECASE)
    if match:
        return match.group(0)
    
    # Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars), treat as payment_id
    # Increased limit from 20 to 50 to accommodate longer payment IDs
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:
        return text
    
    return None

print("="*80)
print("TESTING UPDATED EXTRACTION FUNCTION")
print("="*80 + "\n")

# Test cases from actual database
test_cases = [
    # Actual formats from bog_gel_raw_893486000
    ("NP_D0E5AD_NJ_4532F8_PRL072025", "Standalone salary payment ID"),
    ("NP_bfd2bf_NJ_4532F8_PRL072025", "Lowercase hex digits"),
    ("NP_5beea0_NJ_319b2a_PRL012023", "From salary_accruals table"),
    
    # Various embedding scenarios
    ("payment_id: NP_714645_NJ_A34590_PRL102025", "With prefix label"),
    ("ID: NP_714645_NJ_A34590_PRL102025", "With ID label"),
    ("#NP_714645_NJ_A34590_PRL102025", "With hash prefix"),
    ("Some text NP_714645_NJ_A34590_PRL102025 more text", "Embedded in text"),
    
    # Other payment ID formats
    ("SHORTID123", "Short alphanumeric"),
    ("MEDIUMLENGTH_PAYMENT_ID_12345", "Medium length with underscores"),
    ("VeryLongPaymentIdThatExceedsFiftyCharactersInLengthAndShouldNotMatch", "Too long - should not match"),
    
    # Edge cases
    ("", "Empty string"),
    ("AB", "Too short"),
    (None, "None value"),
]

for test_input, description in test_cases:
    result = extract_payment_id(test_input)
    status = "✅ MATCHED" if result else "❌ NO MATCH"
    
    print(f"{status} - {description}")
    if test_input:
        print(f"  Input: {str(test_input)[:70]}")
    else:
        print(f"  Input: {test_input}")
    print(f"  Extracted: {result}")
    print()

print("="*80)
print("SUMMARY")
print("="*80)
print("✅ Strategy 4: Now matches salary payment ID format NP_xxx_NJ_xxx_PRLxxx")
print("✅ Strategy 5: Increased length limit from 20 to 50 characters")
print("✅ Both standalone and embedded salary payment IDs are extracted")
