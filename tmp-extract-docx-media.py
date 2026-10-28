import zipfile
from pathlib import Path

docx = Path(r"D:\next-postgres-starter\Chrome Logs\Контракт K6NC-0478-0500 Avenue by ORBI.docx")
out = Path(r"D:\next-postgres-starter\tmp_orbi_contract_extract\media")
out.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(docx, 'r') as z:
    names = [n for n in z.namelist() if n.startswith('word/media/')]
    print('media files:', len(names))
    for n in names:
        data = z.read(n)
        target = out / Path(n).name
        target.write_bytes(data)
        print(target.name, len(data))
