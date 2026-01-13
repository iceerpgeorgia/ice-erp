with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("stats['fully_processed'] += 1", "# Fully processed tracked by individual case flags")

with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
    
print('✅ Removed fully_processed stats increment')
