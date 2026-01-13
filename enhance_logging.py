#!/usr/bin/env python3
"""
Add detailed progress logging to import_bank_xml_data.py
"""
import re

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern 1: Add logging for parsing rules (first occurrence in process_bog_gel)
old_pattern_1 = '''    print(f"  ✅ Loaded {len(counteragents_map)} counteragents ({time.time()-dict_start:.2f}s)")
    
    # Load parsing rules
    dict_start = time.time()
    local_cursor.execute("""
        SELECT 
            id,
            counteragent_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            column_name,
            condition
        FROM parsing_scheme_rules
    """)
    parsing_rules = []
    for row in local_cursor.fetchall():'''

new_pattern_1 = '''    print(f"  ✅ Loaded {len(counteragents_map)} counteragents ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load parsing rules
    dict_start = time.time()
    print(f"  ⏳ Loading parsing rules...")
    sys.stdout.flush()
    local_cursor.execute("""
        SELECT 
            id,
            counteragent_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            column_name,
            condition
        FROM parsing_scheme_rules
    """)
    rows = local_cursor.fetchall()
    print(f"  📊 Fetched {len(rows)} parsing rule records from database")
    sys.stdout.flush()
    parsing_rules = []
    for row in rows:'''

# Apply first replacement
content = content.replace(old_pattern_1, new_pattern_1, 1)

# Pattern 2: Update parsing rules completion logging (first occurrence)
old_pattern_2 = '''    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules ({time.time()-dict_start:.2f}s)")
    
    # Load payments'''

new_pattern_2 = '''    print(f"  ✅ Loaded {len(parsing_rules)} parsing rules ({time.time()-dict_start:.2f}s)")
    sys.stdout.flush()
    
    # Load payments'''

content = content.replace(old_pattern_2, new_pattern_2, 1)

# Pattern 3: Add logging for payments (already done but check both functions)
# We need to handle both process_bog_gel and backparse_bog_gel

# Write the file back
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Enhanced logging for dictionaries loading")
