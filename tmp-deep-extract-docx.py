import re, zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
with zipfile.ZipFile(p, 'r') as z:
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')

# raw xml patterns (can cross tags)
patterns = [
    r'PL\s*1\s*2', r'PL\s*1\s*3', r'PL\s*1\s*4', r'PL\s*1\s*5',
    r'SL\s*5', r'SL\s*6', r'SL\s*7', r'SL\s*8',
    r'Appendix\s*#?14', r'Avenue\s*by\s*ORBI', r'OTIS',
    r'\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?'
]
for pat in patterns:
    m = re.findall(pat, xml, flags=re.IGNORECASE)
    print(pat, '=>', len(m))

# flattened text (join all text nodes without line breaks)
texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml)
flat = ''.join(texts)
print('flat length:', len(flat))
for pat in [r'PL12', r'PL13', r'PL14', r'PL15', r'SL5', r'SL6', r'SL7', r'SL8', r'OTIS', r'AVENUE BY ORBI', r'Appendix']:
    print(pat, 'in flat =>', bool(re.search(pat, flat, re.IGNORECASE)))

# print keywords around OTIS/ORBI
for kw in ['OTIS','ORBI','Appendix','Elevator']:
    idx = flat.lower().find(kw.lower())
    if idx>=0:
        s=max(0,idx-300); e=min(len(flat),idx+500)
        print('\n--- around', kw, '---')
        print(flat[s:e])
