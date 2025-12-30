import pandas as pd

df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')
df = df[~df.astype(str).apply(lambda row: row.str.contains('Example:', case=False, na=False).any(), axis=1)]
df = df.dropna(how='all')

print(f"Total rows: {len(df)}")

df_with_ids = df[df['payment_id'].notna() & (df['payment_id'] != '')]
print(f"Rows with payment_id: {len(df_with_ids)}")

dupes = df_with_ids[df_with_ids.duplicated(subset='payment_id', keep=False)].sort_values('payment_id')
print(f"Total duplicate payment_id rows: {len(dupes)}")
print(f"Unique duplicate payment_ids: {dupes['payment_id'].nunique()}")

if len(dupes) > 0:
    print("\nFirst 20 duplicate payment_ids:")
    print(dupes[['payment_id', 'project_uuid', 'counteragent_uuid']].head(20))
