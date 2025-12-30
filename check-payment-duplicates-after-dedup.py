import pandas as pd

df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')
df = df[~df.astype(str).apply(lambda row: row.str.contains('Example:', case=False, na=False).any(), axis=1)]
df = df.dropna(how='all')

print(f"Total rows: {len(df)}")

# Create combo_key like the import script
df['combo_key'] = (
    df['project_uuid'].fillna('') + '|' +
    df['counteragent_uuid'].fillna('') + '|' +
    df['financial_code_uuid'].fillna('') + '|' +
    df['job_uuid'].fillna('') + '|' +
    df['income_tax'].astype(str) + '|' +
    df['currency_uuid'].fillna('')
)

# Deduplicate by combo_key first
df_unique = df.drop_duplicates(subset='combo_key', keep='first').copy()
print(f"After combo_key dedup: {len(df_unique)}")

# Now check for payment_id duplicates in the deduplicated set
df_with_ids = df_unique[df_unique['payment_id'].notna() & (df_unique['payment_id'] != '')]
dupes = df_with_ids[df_with_ids.duplicated(subset='payment_id', keep=False)].sort_values('payment_id')

print(f"Duplicate payment_ids after combo_key dedup: {len(dupes)}")

if len(dupes) > 0:
    print(f"Unique duplicate payment_ids: {dupes['payment_id'].nunique()}")
    print("\nDuplicate payment_ids found:")
    for payment_id in dupes['payment_id'].unique()[:10]:
        subset = dupes[dupes['payment_id'] == payment_id]
        print(f"\n  payment_id: {payment_id} (appears {len(subset)} times)")
        print(subset[['project_uuid', 'counteragent_uuid', 'financial_code_uuid', 'job_uuid']].to_string(index=False))
