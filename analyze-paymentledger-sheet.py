#!/usr/bin/env python3
import pandas as pd

df = pd.read_excel('templates/paymentledger_import_template.xlsx', sheet_name='paymentledger')

print('=' * 80)
print('PAYMENTLEDGER SHEET (Sheet1) ANALYSIS')
print('=' * 80)

print(f'\nTotal rows: {len(df)}')
print(f'Columns: {df.columns.tolist()}')

print('\nNull counts:')
print(df.isnull().sum())

print('\n' + '=' * 80)
print('ACCRUAL vs ORDER BREAKDOWN')
print('=' * 80)

accrual_count = df['accrual'].notna().sum()
order_count = df['order'].notna().sum()
both_null = ((df['accrual'].isna()) & (df['order'].isna())).sum()
both_filled = ((df['accrual'].notna()) & (df['order'].notna())).sum()

print(f'Rows with accrual (not null): {accrual_count}')
print(f'Rows with order (not null): {order_count}')
print(f'Rows with BOTH null: {both_null}')
print(f'Rows with BOTH filled: {both_filled}')

print('\n' + '=' * 80)
print('SAMPLE DATA WITH ACCRUAL')
print('=' * 80)
print(df[df['accrual'].notna()][['paymentId', 'effectiveDate', 'accrual', 'order', 'comment']].head(10))

print('\n' + '=' * 80)
print('SAMPLE DATA WITH ORDER')
print('=' * 80)
print(df[df['order'].notna()][['paymentId', 'effectiveDate', 'accrual', 'order', 'comment']].head(10))

print('\n' + '=' * 80)
print('UNIQUE PAYMENT IDs')
print('=' * 80)
print(f'Unique payment IDs with accrual: {df[df["accrual"].notna()]["paymentId"].nunique()}')
print(f'Unique payment IDs with order: {df[df["order"].notna()]["paymentId"].nunique()}')
print(f'Total unique payment IDs: {df["paymentId"].nunique()}')
