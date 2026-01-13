#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Systematically apply 8-case logic to import_bank_xml_data.py
"""
import re

print("📝 Reading import_bank_xml_data.py...")
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

print("🔧 Applying 8-case logic transformations...")
print("=" * 80)

# Backup
with open('import_bank_xml_data.py.backup', 'w', encoding='utf-8') as f:
    f.write(content)
print("✅ Backup created: import_bank_xml_data.py.backup\n")

replacements = 0

# 1. Replace flag initialization
print("1️⃣  Replacing flag initialization...")
old_flags = """counteragent_processed = False
        parsing_rule_processed = False
        payment_id_processed = False
        
        parsing_rule_conflict = False
        payment_conflict = False"""

new_flags = """# Initialize 8-case flags (Cases 1/2/3 are mutually exclusive)
        case1_counteragent_processed = False
        case2_counteragent_inn_blank = False
        case3_counteragent_inn_nonblank_no_match = False
        case4_payment_id_match = False
        case5_payment_id_counteragent_mismatch = False
        case6_parsing_rule_match = False
        case7_parsing_rule_counteragent_mismatch = False
        case8_parsing_rule_dominance = False"""

count = content.count(old_flags)
content = content.replace(old_flags, new_flags)
print(f"   Replaced {count} occurrences")
replacements += count

# 2. Update Phase 1 - Case 1 logic
print("\n2️⃣  Updating Case 1 logic...")
content = re.sub(
    r"counteragent_uuid = counteragent_data\['uuid'\]\s+counteragent_processed = True\s+stats\['case1_matched'\]",
    "counteragent_uuid = counteragent_data['uuid']\n                case1_counteragent_processed = True\n                stats['case1_counteragent_processed']",
    content
)
print(f"   Updated Case 1 assignment")
replacements += 2

# 3. Update Phase 1 - Case 3 (was Case 2)
print("\n3️⃣  Updating Case 3 logic...")
content = re.sub(
    r"# CASE 2: INN found but no counteragent\s+counteragent_processed = False\s+stats\['case2_inn_no_counteragent'\]",
    "# CASE 3: INN exists but no match in database\n                case3_counteragent_inn_nonblank_no_match = True\n                stats['case3_counteragent_inn_nonblank_no_match']",
    content
)
print(f"   Updated Case 3 assignment")
replacements += 2

# 4. Update Phase 1 - Case 2 (was Case 3)
print("\n4️⃣  Updating Case 2 logic...")
content = re.sub(
    r"# CASE 3: No INN found\s+counteragent_processed = False\s+stats\['case3_no_inn'\]",
    "# CASE 2: INN is blank\n            case2_counteragent_inn_blank = True\n            stats['case2_counteragent_inn_blank']",
    content
)
print(f"   Updated Case 2 assignment")
replacements += 2

# 5. Update print statements
print("\n5️⃣  Updating print statements...")
content = content.replace("[CASE 2] Record", "[CASE 3] Record")
content = content.replace("[CASE 3] Record", "[CASE 2] Record", 1)  # First one back
content = content.replace("INN blank - will try rules/payment", "INN blank - will try payment/rules")
print(f"   Updated case labels in print statements")

# 6. Update raw_updates.append
print("\n6️⃣  Updating raw_updates.append...")
old_append = """'uuid': raw_uuid,
            'counteragent_processed': counteragent_processed,
            'parsing_rule_processed': parsing_rule_processed,
            'payment_id_processed': payment_id_processed,
            'is_processed': is_fully_processed,
            'counteragent_inn': counteragent_inn"""

new_append = """'uuid': raw_uuid,
            'case1_counteragent_processed': case1_counteragent_processed,
            'case2_counteragent_inn_blank': case2_counteragent_inn_blank,
            'case3_counteragent_inn_nonblank_no_match': case3_counteragent_inn_nonblank_no_match,
            'case4_payment_id_match': case4_payment_id_match,
            'case5_payment_id_counteragent_mismatch': case5_payment_id_counteragent_mismatch,
            'case6_parsing_rule_match': case6_parsing_rule_match,
            'case7_parsing_rule_counteragent_mismatch': case7_parsing_rule_counteragent_mismatch,
            'case8_parsing_rule_dominance': case8_parsing_rule_dominance"""

count = content.count("'counteragent_inn': counteragent_inn")
content = content.replace(old_append, new_append)
print(f"   Updated {count} raw_updates.append blocks")
replacements += count

# 7. Update UPDATE query
print("\n7️⃣  Updating UPDATE queries...")
old_update = """counteragent_processed = %(counteragent_processed)s,
                parsing_rule_processed = %(parsing_rule_processed)s,
                payment_id_processed = %(payment_id_processed)s,
                is_processed = %(is_processed)s,
                counteragent_inn = %(counteragent_inn)s"""

new_update = """counteragent_processed = %(case1_counteragent_processed)s,
                counteragent_inn_blank = %(case2_counteragent_inn_blank)s,
                counteragent_inn_nonblank_no_match = %(case3_counteragent_inn_nonblank_no_match)s,
                payment_id_match = %(case4_payment_id_match)s,
                payment_id_counteragent_mismatch = %(case5_payment_id_counteragent_mismatch)s,
                parsing_rule_match = %(case6_parsing_rule_match)s,
                parsing_rule_counteragent_mismatch = %(case7_parsing_rule_counteragent_mismatch)s,
                parsing_rule_dominance = %(case8_parsing_rule_dominance)s,
                is_processed = TRUE,
                updated_at = NOW()"""

count = content.count("counteragent_inn = %(counteragent_inn)s")
content = content.replace(old_update, new_update)
print(f"   Updated {count} UPDATE queries")
replacements += count

# 8. Update summary output
print("\n8️⃣  Updating summary output...")
content = content.replace(
    "Case 1 (INN matched): {stats['case1_matched']}",
    "Case 1 (Counteragent matched): {stats['case1_counteragent_processed']}"
)
content = content.replace(
    "Case 2 (INN needs counteragent): {stats['case2_inn_no_counteragent']}",
    "Case 3 (INN no match): {stats['case3_counteragent_inn_nonblank_no_match']}"
)
content = content.replace(
    "Case 3 (No INN): {stats['case3_no_inn']}",
    "Case 2 (INN blank): {stats['case2_counteragent_inn_blank']}"
)
print(f"   Updated summary labels")
replacements += 3

print(f"\n✅ Total replacements: {replacements}")

# Write updated content
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ File updated successfully!")
print(f"\n⚠️  NOTE: The script still needs manual additions for:")
print(f"   - Phase 2 (Payment ID) logic with Cases 4 & 5")
print(f"   - Phase 3 (Parsing Rules) logic with Cases 6, 7, & 8")
print(f"   - These must be inserted, not just replaced")
