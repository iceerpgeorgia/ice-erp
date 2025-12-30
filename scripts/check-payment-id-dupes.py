import pandas as pd

# Read template
df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')

# Clean payment_id
df['payment_id'] = df['payment_id'].astype(str).str.strip()

# Filter valid payment_ids
valid_df = df[df['payment_id'].notna() & (df['payment_id'] != '') & (df['payment_id'] != 'nan')].copy()

print(f"Total rows: {len(df)}")
print(f"Rows with payment_id: {len(valid_df)}")
print(f"Unique payment_ids: {valid_df['payment_id'].nunique()}")

# Check for duplicates
dupes = valid_df[valid_df.duplicated(subset=['payment_id'], keep=False)].sort_values('payment_id')

if len(dupes) > 0:
    print(f"\n❌ Found {len(dupes)} duplicate payment_ids:")
    print(dupes[['payment_id', 'project_uuid', 'counteragent_uuid']].head(30))
else:
    print("\n✅ No duplicate payment_ids in template!")

# Now check combo_key duplicates
valid_df['combo_key'] = (
    valid_df['project_uuid'].astype(str) + '|' +
    valid_df['counteragent_uuid'].astype(str) + '|' +
    valid_df['financial_code_uuid'].astype(str) + '|' +
    valid_df['job_uuid'].fillna('').astype(str) + '|' +
    valid_df['income_tax'].astype(str) + '|' +
    valid_df['currency_uuid'].astype(str)
)

combo_dupes = valid_df[valid_df.duplicated(subset=['combo_key'], keep=False)].sort_values('combo_key')
print(f"\nRows with duplicate combo_keys: {len(combo_dupes)}")

# After deduplication by combo_key, how many payment_id dupes remain?
deduped_df = valid_df.drop_duplicates(subset='combo_key', keep='first')
print(f"\nAfter combo_key dedup: {len(deduped_df)} records")

payment_id_dupes_after = deduped_df[deduped_df.duplicated(subset=['payment_id'], keep=False)].sort_values('payment_id')
print(f"Payment_id duplicates AFTER combo_key dedup: {len(payment_id_dupes_after)}")

if len(payment_id_dupes_after) > 0:
    print("\n❌ These payment_ids appear multiple times AFTER combo_key dedup:")
    print(payment_id_dupes_after[['payment_id', 'project_uuid', 'counteragent_uuid', 'combo_key']])
