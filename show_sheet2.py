import zipfile

with zipfile.ZipFile('public/Handover Tamplate New.xlsx', 'r') as z:
    with z.open('xl/worksheets/sheet2.xml') as f:
        content = f.read().decode('utf-8')
        print(content)
