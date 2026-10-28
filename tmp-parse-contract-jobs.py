import re
import zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
with zipfile.ZipFile(p, 'r') as z:
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')

# Flatten text nodes quickly
texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml)
plain = '\n'.join(t.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>') for t in texts)

# Print nearby snippets around elevator ids
ids = ['PL12','PL13','PL14','PL15','SL5','SL6','SL7','SL8']
for idv in ids:
    idx = plain.find(idv)
    if idx == -1:
        print(f'NOT_FOUND: {idv}')
        continue
    s = max(0, idx-300)
    e = min(len(plain), idx+500)
    print(f"\n--- {idv} ---")
    print(plain[s:e])

# Print all currency-looking values and key words
print('\n=== MONEY TOKENS SAMPLE ===')
money = re.findall(r'\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?', plain)
for m in money[:200]:
    print(m)

print('\n=== CONTAINS 89813 ===', '89,813' in plain or '89813' in plain)
print('=== CONTAINS 340,165.00 ===', '340,165.00' in plain)
