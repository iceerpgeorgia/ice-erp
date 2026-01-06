#!/usr/bin/env python3
import pandas as pd

xl = pd.ExcelFile('templates/Consolidated_payments_ledger_import.xlsx')
print("=" * 80)
print("CONSOLIDATED PAYMENTS LEDGER TEMPLATE ANALYSIS")
print("=" * 80)
print(f"\nAvailable sheets: {xl.sheet_names}")

# Try Sheet2 (likely the consolidated one)
df = pd.read_excel('templates/Consolidated_payments_ledger_import.xlsx', sheet_name='Sheet2')

print(f"\nTotal rows: {len(df)}")
print(f"\nColumns: {df.columns.tolist()}")

print("\nNull counts:")
print(df.isnull().sum())

print("\n" + "=" * 80)
print("DATA BREAKDOWN")
print("=" * 80)

accrual_count = df['accrual'].notna().sum()
order_count = df['order'].notna().sum()
both_null = ((df['accrual'].isna()) & (df['order'].isna())).sum()
both_filled = ((df['accrual'].notna()) & (df['order'].notna())).sum()

print(f"\nRows with accrual (not null): {accrual_count}")
print(f"Rows with order (not null): {order_count}")
print(f"Rows with BOTH null: {both_null}")
print(f"Rows with BOTH filled: {both_filled}")

print(f"\nUnique payment IDs: {df['paymentId'].nunique()}")

print("\n" + "=" * 80)
print("SAMPLE DATA")
print("=" * 80)
print("\nFirst 5 rows:")
print(df[['paymentId', 'effectiveDate', 'accrual', 'order', 'comment']].head())

print("\nRows with both accrual and order (first 5):")
both_df = df[(df['accrual'].notna()) & (df['order'].notna())]
if len(both_df) > 0:
    print(both_df[['paymentId', 'effectiveDate', 'accrual', 'order']].head())
else:
    print("  (no rows with both values)")

print("\n" + "=" * 80)
