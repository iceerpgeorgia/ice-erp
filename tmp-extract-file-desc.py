import re, zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\File_description_EN.docx")
with zipfile.ZipFile(p, 'r') as z:
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml)
plain = '\n'.join(t.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>') for t in texts)

codes = sorted(set(re.findall(r'\b(?:PL\d{1,2}|SL\d{1,2}|S\d{1,2})\b', plain)))
print('CODES:', ', '.join(codes))
print('COUNT:', len(codes))

# Print lines around code occurrences
lines = [ln.strip() for ln in plain.split('\n') if ln.strip()]
for c in codes:
    print(f'\n=== {c} ===')
    hits = 0
    for i, ln in enumerate(lines):
        if c in ln:
            print(ln)
            hits += 1
            if hits >= 8:
                break
