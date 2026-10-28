import re, zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
with zipfile.ZipFile(p, 'r') as z:
    xml = z.read('word/document.xml').decode('utf-8', errors='ignore')

# Page break markers and section markers as rough page indicators
br = len(re.findall(r'<w:br[^>]*w:type="page"', xml))
last = len(re.findall(r'<w:lastRenderedPageBreak\b', xml))
sect = len(re.findall(r'<w:sectPr\b', xml))

print('pageBreak tags:', br)
print('lastRenderedPageBreak tags:', last)
print('section tags:', sect)
