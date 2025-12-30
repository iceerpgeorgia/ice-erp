import pandas as pd

df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')
df = df[~df.astype(str).apply(lambda row: row.str.contains('Example:', case=False, na=False).any(), axis=1)]
df = df.dropna(how='all')

# Create combo_key
df['combo_key'] = (
    df['project_uuid'].fillna('') + '|' +
    df['counteragent_uuid'].fillna('') + '|' +
    df['financial_code_uuid'].fillna('') + '|' +
    df['job_uuid'].fillna('') + '|' +
    df['income_tax'].astype(str) + '|' +
    df['currency_uuid'].fillna('')
)

df_unique = df.drop_duplicates(subset='combo_key', keep='first').copy()
df_with_payment_id = df_unique[df_unique['payment_id'].notna() & (df_unique['payment_id'] != '')]
df_without_payment_id = df_unique[df_unique['payment_id'].isna() | (df_unique['payment_id'] == '')]
df_with_payment_id_unique = df_with_payment_id.drop_duplicates(subset='payment_id', keep='first')
df_unique = pd.concat([df_with_payment_id_unique, df_without_payment_id], ignore_index=True)

print(f"After full deduplication: {len(df_unique)}")

# Now process payment_ids like the script does
records = []
for idx, row in df_unique.iterrows():
    payment_id = row.get('payment_id')
    payment_id_to_use = str(payment_id).strip() if pd.notna(payment_id) and payment_id != '' else ''
    records.append(payment_id_to_use)

# Check for duplicates in the processed payment_ids
from collections import Counter
payment_id_counts = Counter([pid for pid in records if pid])
duplicates = {pid: count for pid, count in payment_id_counts.items() if count > 1}

print(f"Total non-empty payment_ids: {len([p for p in records if p])}")
print(f"Duplicate payment_ids in records: {len(duplicates)}")

if duplicates:
    print("\nDuplicate payment_ids:")
    for pid, count in list(duplicates.items())[:10]:
        print(f"  {pid}: appears {count} times")
