import re, zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
with zipfile.ZipFile(p, 'r') as z:
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml)
flat = ''.join(texts)

# primary patterns
pat = re.compile(r'\b(?:PL\d{1,2}|SL\d{1,2}|S\d{1,2}|P\d{4}|L\d{4})\b', re.IGNORECASE)
codes = sorted(set(m.upper() for m in pat.findall(flat)))
print('DIRECT_CODES_COUNT', len(codes))
print('DIRECT_CODES', codes)

# split-digit recovery for cases like PL1 2 / SL 7
tokens = re.findall(r'[A-Za-z]+|\d+', flat)
recovered = set(codes)
for i in range(len(tokens)-2):
    a,b,c = tokens[i], tokens[i+1], tokens[i+2]
    au = a.upper()
    if au in {'PL','SL','S','P','L'} and b.isdigit() and c.isdigit():
        cand = au + b + c
        # constrain to realistic lengths
        if au in {'PL','SL'} and len(b+c)<=2:
            recovered.add(cand)
        if au in {'S'} and len(b+c)<=2:
            recovered.add(cand)
        if au in {'P','L'} and len(b+c)<=4:
            recovered.add(cand)

# also recover two-token patterns PL + 12
for i in range(len(tokens)-1):
    a,b = tokens[i], tokens[i+1]
    au = a.upper()
    if au in {'PL','SL'} and b.isdigit() and len(b)<=2:
        recovered.add(au+b)
    if au in {'S'} and b.isdigit() and len(b)<=2:
        recovered.add(au+b)
    if au in {'P','L'} and b.isdigit() and len(b)<=4:
        recovered.add(au+b)

clean = sorted(recovered)
print('RECOVERED_COUNT', len(clean))
print('RECOVERED_CODES', clean)

# Filter to likely elevator IDs for this contract context
likely = sorted([c for c in clean if re.match(r'^(PL\d{1,2}|SL\d{1,2}|S\d{1,2})$', c)])
print('LIKELY_COUNT', len(likely))
print('LIKELY_CODES', likely)
