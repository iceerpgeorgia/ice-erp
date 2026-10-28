import re
from pathlib import Path

p = Path(r"D:\next-postgres-starter\File_description_EN.pdf")
# Lightweight binary grep for plain tokens inside PDF streams
b = p.read_bytes().decode('latin1', errors='ignore')
for pat in [r'PL\d{1,2}', r'SL\d{1,2}', r'S\d{1,2}']:
    vals = sorted(set(re.findall(pat, b)))
    print(pat, len(vals), vals[:80])
