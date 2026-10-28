import re, zipfile
from pathlib import Path

root = Path(r"D:\next-postgres-starter")
files = sorted(root.rglob('*.docx'))
for p in files:
    try:
        with zipfile.ZipFile(p, 'r') as z:
            if 'word/document.xml' not in z.namelist():
                continue
            xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
            text = '\n'.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml))
            codes = sorted(set(re.findall(r'\b(?:PL\d{1,2}|SL\d{1,2}|S\d{1,2}|P\d{4}|L\d{4})\b', text)))
            if codes:
                print('\nFILE:', p)
                print('COUNT:', len(codes))
                print('CODES:', ', '.join(codes[:200]))
    except Exception as e:
        pass
