#!/usr/bin/env python3
"""Analyze DICT_USERS.xlsx structure"""

import pandas as pd
import openpyxl

wb = openpyxl.load_workbook('DICT_USERS.xlsx')
sheets = wb.sheetnames

print("=" * 80)
print("DICT_USERS.xlsx Analysis")
print("=" * 80)

for sheet in sheets:
    df = pd.read_excel('DICT_USERS.xlsx', sheet_name=sheet, nrows=5)
    print(f"\n=== {sheet} ===")
    print(f"Rows: {len(pd.read_excel('DICT_USERS.xlsx', sheet_name=sheet))}")
    print(f"Columns: {list(df.columns)}")
    if len(df) > 0:
        print(f"\nSample (first row):")
        for col in df.columns:
            val = df[col].iloc[0]
            if pd.notna(val):
                print(f"  {col}: {val}")
