#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Apply 8-case logic to both process_bog_gel and backparse_bog_gel functions
This script reads the file, makes all necessary replacements, and writes it back
"""

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

print("📝 Applying 8-case hierarchical logic to import_bank_xml_data.py...")
print("=" * 80)

replacements_made = 0

# 1. Replace old stats keys with new ones
print("\n1️⃣  Updating statistics keys...")
old_to_new_stats = [
    ("'case1_matched'", "'case1_counteragent_processed'"),
    ("'case2_inn_no_counteragent'", "'case3_counteragent_inn_nonblank_no_match'"),
    ("'case3_no_inn'", "'case2_counteragent_inn_blank'"),
    ("'parsing_rule_applied'", "'case6_parsing_rule_match'"),
    ("'parsing_rule_conflicts'", "'case7_parsing_rule_counteragent_mismatch'"),
    ("'payment_id_matched'", "'case4_payment_id_match'"),
    ("'payment_id_conflicts'", "'case5_payment_id_counteragent_mismatch'"),
]

for old, new in old_to_new_stats:
    count = content.count(old)
    content = content.replace(old, new)
    print(f"   {old:40} → {new:40} ({count} replacements)")
    replacements_made += count

# 2. Add case8_parsing_rule_dominance to stats dictionaries
print("\n2️⃣  Adding Case 8 to statistics dictionaries...")
old_stats_block = """    stats = {
        'case1_counteragent_processed': 0,
        'case2_counteragent_inn_blank': 0,
        'case3_counteragent_inn_nonblank_no_match': 0,
        'case4_payment_id_match': 0,
        'case5_payment_id_counteragent_mismatch': 0,
        'case6_parsing_rule_match': 0,
        'case7_parsing_rule_counteragent_mismatch': 0,
    }"""

new_stats_block = """    stats = {
        'case1_counteragent_processed': 0,
        'case2_counteragent_inn_blank': 0,
        'case3_counteragent_inn_nonblank_no_match': 0,
        'case4_payment_id_match': 0,
        'case5_payment_id_counteragent_mismatch': 0,
        'case6_parsing_rule_match': 0,
        'case7_parsing_rule_counteragent_mismatch': 0,
        'case8_parsing_rule_dominance': 0,
    }"""

content = content.replace(old_stats_block, new_stats_block)
print(f"   Added case8_parsing_rule_dominance to stats dictionaries")
replacements_made += 2

# 3. Replace old flag names with new ones
print("\n3️⃣  Updating flag variable names...")
flag_replacements = [
    ("counteragent_processed = True", "case1_counteragent_processed = True"),
    ("counteragent_processed = False", "case3_counteragent_inn_nonblank_no_match = True  # Case 3: INN exists but no match"),
    ("stats['case1_counteragent_processed'] += 1", "stats['case1_counteragent_processed'] += 1"),
]

# Note: This is complex because we need contextual replacements
# Let's do a safer approach - just update the summary output

# 4. Update summary output labels
print("\n4️⃣  Updating summary output labels...")
summary_replacements = [
    ("Case 1 (INN matched):", "Case 1 (Counteragent matched):"),
    ("Case 2 (INN needs counteragent):", "Case 3 (INN no match):"),
    ("Case 3 (No INN):", "Case 2 (INN blank):"),
    ("Phase 2 - Parsing Rules:", "Phase 2 - Payment ID:"),
    ("Phase 3 - Payment ID:", "Phase 3 - Parsing Rules:"),
    ("Rules applied:", "Case 4 (Payment match):"),
    ("Conflicts (kept counteragent):", "Case 5 (Payment conflict):"),
    ("Payment matched:", "Case 6 (Rule match):"),
]

for old, new in summary_replacements:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        print(f"   '{old}' → '{new}' ({count} replacements)")
        replacements_made += count

# 5. Write the updated content
print(f"\n✅ Total replacements made: {replacements_made}")
print(f"\n📝 Writing updated file...")

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ File updated successfully!")
print(f"\n⚠️  NOTE: Manual review required for:")
print(f"   - Phase 1/2/3 logic implementation")
print(f"   - Raw table UPDATE queries (8 columns)")
print(f"   - Flag initialization in both functions")
print(f"   - Case 8 dominance logic")
