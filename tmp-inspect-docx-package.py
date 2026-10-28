import zipfile
from pathlib import Path

p = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
with zipfile.ZipFile(p, 'r') as z:
    names = sorted(z.namelist())
    print('TOTAL FILES:', len(names))
    for n in names:
        print(n)
