"""
Add applied_rule_id to temp table updates in import_bank_xml_data.py
This script updates all 4 locations where temp_flag_updates is used
"""
import re

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern 1: CREATE TEMP TABLE temp_flag_updates - add applied_rule_id column
old_create = r'''CREATE TEMP TABLE temp_flag_updates \(
                uuid UUID,
                counteragent_processed BOOLEAN,
                counteragent_found BOOLEAN,
                counteragent_missing BOOLEAN,
                payment_id_matched BOOLEAN,
                payment_id_conflict BOOLEAN,
                parsing_rule_applied BOOLEAN,
                parsing_rule_conflict BOOLEAN,
                counteragent_inn TEXT,
                processing_case TEXT
            \)'''

new_create = '''CREATE TEMP TABLE temp_flag_updates (
                uuid UUID,
                counteragent_processed BOOLEAN,
                counteragent_found BOOLEAN,
                counteragent_missing BOOLEAN,
                payment_id_matched BOOLEAN,
                payment_id_conflict BOOLEAN,
                parsing_rule_applied BOOLEAN,
                parsing_rule_conflict BOOLEAN,
                counteragent_inn TEXT,
                applied_rule_id INTEGER,
                processing_case TEXT
            )'''

content = content.replace(old_create.replace(r'\(', '(').replace(r'\)', ')'), new_create)

# Pattern 2: copy_from columns tuple - add applied_rule_id
old_copy = "'uuid', 'counteragent_processed', 'counteragent_found', 'counteragent_missing', 'payment_id_matched', 'payment_id_conflict', 'parsing_rule_applied', 'parsing_rule_conflict', 'counteragent_inn', 'processing_case'"
new_copy = "'uuid', 'counteragent_processed', 'counteragent_found', 'counteragent_missing', 'payment_id_matched', 'payment_id_conflict', 'parsing_rule_applied', 'parsing_rule_conflict', 'counteragent_inn', 'applied_rule_id', 'processing_case'"

content = content.replace(old_copy, new_copy)

# Pattern 3: UPDATE statement - add applied_rule_id
old_update = '''UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.counteragent_processed,
                counteragent_found = tmp.counteragent_found,
                counteragent_missing = tmp.counteragent_missing,
                payment_id_matched = tmp.payment_id_matched,
                payment_id_conflict = tmp.payment_id_conflict,
                parsing_rule_applied = tmp.parsing_rule_applied,
                parsing_rule_conflict = tmp.parsing_rule_conflict,
                counteragent_inn = tmp.counteragent_inn,
                processing_case = tmp.processing_case,'''

new_update = '''UPDATE {raw_table_name} AS raw SET
                counteragent_processed = tmp.counteragent_processed,
                counteragent_found = tmp.counteragent_found,
                counteragent_missing = tmp.counteragent_missing,
                payment_id_matched = tmp.payment_id_matched,
                payment_id_conflict = tmp.payment_id_conflict,
                parsing_rule_applied = tmp.parsing_rule_applied,
                parsing_rule_conflict = tmp.parsing_rule_conflict,
                counteragent_inn = tmp.counteragent_inn,
                applied_rule_id = tmp.applied_rule_id,
                processing_case = tmp.processing_case,'''

content = content.replace(old_update, new_update)

# Pattern 4: buffer.write with tab-separated values - add applied_rule_id
# This is trickier - need to add the field after counteragent_inn

# Find all buffer.write lines and add applied_rule_id
import re
pattern = r"(buffer\.write\(f\"{update\['uuid'\]}\\t{update\['counteragent_processed'\]}\\t{update\['counteragent_found'\]}\\t{update\['counteragent_missing'\]}\\t{update\['payment_id_matched'\]}\\t{update\['payment_id_conflict'\]}\\t{update\['parsing_rule_applied'\]}\\t{update\['parsing_rule_conflict'\]}\\t{inn}\\t){processing_case}\\n\"\))"

replacement = r"\1{update.get('applied_rule_id', '')}\\t{processing_case}\\n\")"

content = re.sub(pattern, replacement, content)

# Write back
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Updated import_bank_xml_data.py with applied_rule_id tracking")
print("   - Added applied_rule_id column to temp table")
print("   - Added applied_rule_id to copy_from columns")
print("   - Added applied_rule_id to UPDATE statement")
print("   - Added applied_rule_id to buffer.write")
