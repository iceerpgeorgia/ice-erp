#!/usr/bin/env python3
"""
Fix fully_processed stats references in import_bank_xml_data.py
"""

# Read the file
with open('import_bank_xml_data.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of the fully_processed stats line
old_line = "    print(f\"  ✅ Fully processed: {stats['fully_processed']}\")"
content = content.replace(old_line, "")

# Clean up double blank lines that might result
content = content.replace('\n\n\n', '\n\n')

# Write back
with open('import_bank_xml_data.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Removed all fully_processed stats lines")
