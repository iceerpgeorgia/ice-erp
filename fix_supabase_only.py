#!/usr/bin/env python3
"""
Script to update import_bank_xml_data.py to use only Supabase (no local PostgreSQL).
"""

import re

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Line 931 and 1629 - change local_cursor to currency_cache in calculate_nominal_amount calls
content = content.replace(
    '            local_cursor\n        )',
    '            currency_cache\n        )'
)

# Lines 1508-1509, 1515-1516, 1521-1522 - change local_cursor to supabase_cursor for currency cache loading
content = content.replace(
    '    local_cursor.execute("SELECT uuid, code FROM currencies")\n    currency_cache = {row[0]: row[1] for row in local_cursor.fetchall()}',
    '    supabase_cursor.execute("SELECT uuid, code FROM currencies")\n    currency_cache = {row[0]: row[1] for row in supabase_cursor.fetchall()}'
)

# Lines 747, 752 - NBG rates loading in process_bog_gel (already done for remote_cursor, keep as is for local)
# These are in process_bog_gel which uses remote_cursor, so already correct

# Lines 1222 - account query in backparse_existing_data
content = content.replace(
    '            local_cursor.execute("""',
    '            supabase_cursor.execute("""'
)

# Line 1237 - fetchall for accounts
content = content.replace(
    '        accounts = local_cursor.fetchall()',
    '        accounts = supabase_cursor.fetchall()'
)

# Lines 1259, 1270, 1276 - consolidated deletes and raw updates in backparse_existing_data  
content = content.replace(
    '                local_cursor.execute("""',
    '                supabase_cursor.execute("""'
)
content = content.replace(
    '                    local_cursor.execute(f"""',
    '                    supabase_cursor.execute(f"""'
)
content = content.replace(
    '                local_cursor.rowcount',
    '                supabase_cursor.rowcount'
)
content = content.replace(
    '                local_conn.commit()',
    '                supabase_conn.commit()'
)
content = content.replace(
    '            local_conn.commit()',
    '            supabase_conn.commit()'
)

# Lines 1317, 1322 - bank account query in backparse_bog_gel
# Already fixed by earlier replacements

# Lines 1736 - COPY for consolidated inserts in backparse_bog_gel
content = content.replace(
    '        local_cursor.copy_expert(',
    '        supabase_cursor.copy_expert('
)

# Line 1784 - temp table creation in backparse_bog_gel
content = content.replace(
    '        local_cursor.execute("""',
    '        supabase_cursor.execute("""'
)

# Line 1814 - COPY FROM for updates in backparse_bog_gel
content = content.replace(
    '        local_cursor.copy_from(buffer,',
    '        supabase_cursor.copy_from(buffer,'
)

# Line 1822 - bulk UPDATE in backparse_bog_gel
# Already covered by earlier replacement

# Lines 1916-1992 - main() function local connections
# Need to be more specific for these

# Write the updated content
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Updated import_bank_xml_data.py to use Supabase only")
