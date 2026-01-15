#!/usr/bin/env python3
"""Fix nominal_amount calculation to use base amounts instead of account currency amounts"""

with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of "nominal_amount = account_currency_amount"
# with "nominal_amount = nominal_amount_calculated"
content = content.replace(
    '        nominal_amount = account_currency_amount',
    '        nominal_amount = nominal_amount_calculated'
)

# Update comments for clarity
content = content.replace(
    '        # Set defaults for missing values\n        nominal_currency_uuid',
    '        # Set defaults for missing values\n        # If nominal_currency_uuid not set by rules/payment, use account currency\n        # Nominal amount comes from base amounts (EntryDbAmtBase, EntryCrAmtBase) in GEL\n        nominal_currency_uuid'
)

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Fixed nominal_amount calculation in import_bank_xml_data.py')
print('   - Changed from: nominal_amount = account_currency_amount')
print('   - Changed to:   nominal_amount = nominal_amount_calculated')
