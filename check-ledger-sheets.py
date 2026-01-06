#!/usr/bin/env python3
import pandas as pd

xl = pd.ExcelFile('templates/paymentledger_import_template.xlsx')
print('Available sheets:', xl.sheet_names)
print()

for sheet in xl.sheet_names:
    df = pd.read_excel('templates/paymentledger_import_template.xlsx', sheet_name=sheet)
    print(f'Sheet: {sheet}')
    print(f'  Rows: {len(df)}')
    print(f'  Columns: {df.columns.tolist()[:10]}...')
    print(f'  First 3 rows:')
    print(df.head(3))
    print()
