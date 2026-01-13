with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("stats['parsing_rule_applied']", "stats['case6_parsing_rule_match']")
content = content.replace("stats['parsing_rule_conflicts']", "stats['case7_parsing_rule_counteragent_mismatch']")
content = content.replace("stats['payment_id_matched']", "stats['case4_payment_id_match']")
content = content.replace("stats['payment_id_conflicts']", "stats['case5_payment_id_counteragent_mismatch']")

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
    
print('✅ Replaced all remaining stats keys')
