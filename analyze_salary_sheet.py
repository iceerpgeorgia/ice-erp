import pandas as pd
import json

xl = pd.ExcelFile('Salary_Accruals.xlsx')
print('SHEETS:', json.dumps(xl.sheet_names))

for sheet in xl.sheet_names:
    df = pd.read_excel('Salary_Accruals.xlsx', sheet_name=sheet, nrows=10)
    print(f'\n{"="*60}')
    print(f'SHEET: {sheet}')
    print(f'{"="*60}')
    print(f'Columns ({len(df.columns)}): {list(df.columns)}')
    print(f'Shape: {df.shape[0]} rows x {df.shape[1]} columns')
    print(f'\nFirst rows:')
    print(df.head(10).to_string())
    print()
