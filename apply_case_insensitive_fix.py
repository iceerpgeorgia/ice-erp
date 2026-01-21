import re

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

print("Applying fixes...")

# Fix 1: Add salary payment ID pattern extraction (before Strategy 4)
old_strategy4 = '''    # Strategy 4: If entire text is alphanumeric and reasonable length (5-20 chars), treat as payment_id
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 20:'''

new_strategy4 = '''    # Strategy 4: Look for salary accrual payment ID pattern (NP_xxx_NJ_xxx_PRLxxx)
    # This matches the format: NP_{6hex}_NJ_{6hex}_PRL{MMYYYY}
    # Support both uppercase and lowercase hex (a-f, A-F)
    match = re.search(r'NP_[A-Fa-f0-9]{6}_NJ_[A-Fa-f0-9]{6}_PRL\\d{6}', text)
    if match:
        return match.group(0)
    
    # Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars), treat as payment_id
    # Increased limit from 20 to 50 to accommodate longer payment IDs
    if re.match(r'^[A-Z0-9-_]+$', text, re.IGNORECASE) and 5 <= len(text) <= 50:'''

content = content.replace(old_strategy4, new_strategy4)
print("✓ Added salary pattern extraction")

# Fix 2: Case-insensitive map building (occurs twice in file)
old_map_building = '''        if payment_id:
            # Priority: payments table over salary_accruals (first occurrence wins)
            if payment_id not in payments_map:
                payments_map[payment_id] = {'''

new_map_building = '''        if payment_id:
            # Priority: payments table over salary_accruals (first occurrence wins)
            # Use lowercase key for case-insensitive matching
            payment_id_lower = payment_id.lower()
            if payment_id_lower not in payments_map:
                payments_map[payment_id_lower] = {'''

content = content.replace(old_map_building, new_map_building)
print("✓ Applied case-insensitive map building")

# Fix 3: Case-insensitive lookup for extracted payment_id (occurs twice)
old_lookup1 = '''    extracted_payment_id = extract_payment_id(DocInformation)
    if extracted_payment_id and extracted_payment_id in payments_map:
        payment_data = payments_map[extracted_payment_id]'''

new_lookup1 = '''    extracted_payment_id = extract_payment_id(DocInformation)
    if extracted_payment_id:
        # Case-insensitive lookup
        payment_id_lower = extracted_payment_id.lower()
        if payment_id_lower in payments_map:
            payment_data = payments_map[payment_id_lower]'''

content = content.replace(old_lookup1, new_lookup1)
print("✓ Applied case-insensitive payment_id lookup")

# Fix 4: Case-insensitive lookup for rule payment_id (occurs twice)
old_lookup2 = '''        if rule_payment_id and rule_payment_id in payments_map:
            rule_payment_data = payments_map[rule_payment_id]'''

new_lookup2 = '''        if rule_payment_id:
            # Case-insensitive lookup
            rule_payment_id_lower = rule_payment_id.lower()
            if rule_payment_id_lower in payments_map:
                rule_payment_data = payments_map[rule_payment_id_lower]'''

content = content.replace(old_lookup2, new_lookup2)
print("✓ Applied case-insensitive rule payment_id lookup")

# Write back
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ All fixes applied successfully!")
