import pandas as pd
import sys
from collections import Counter

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*90)
print("DETAILED EXAMINATION: templates/counteragent_import_template.xlsx")
print("="*90)

# Load all sheets
excel_file = pd.ExcelFile('templates/counteragent_import_template.xlsx')
print(f"\n📑 Sheets found: {excel_file.sheet_names}")

# Examine each sheet
for sheet_name in excel_file.sheet_names:
    print(f"\n{'='*90}")
    print(f"SHEET: {sheet_name}")
    print("="*90)
    
    df = pd.read_excel('templates/counteragent_import_template.xlsx', sheet_name=sheet_name)
    
    print(f"\nDimensions: {len(df)} rows × {len(df.columns)} columns")
    
    # Column details
    print(f"\n📋 COLUMNS ({len(df.columns)}):")
    for i, col in enumerate(df.columns, 1):
        dtype = df[col].dtype
        non_null = df[col].notna().sum()
        null_count = df[col].isna().sum()
        unique_vals = df[col].nunique()
        
        # Sample non-null value
        sample = df[col].dropna().iloc[0] if non_null > 0 else None
        sample_str = f" | Sample: {str(sample)[:40]}" if sample is not None else ""
        
        print(f"  {i:2d}. {col:<35} | {str(dtype):<15} | Non-null: {non_null:4d} | Unique: {unique_vals:4d}{sample_str}")
    
    # Data quality analysis
    print(f"\n📊 DATA QUALITY:")
    
    # Check entity_type_uuid distribution
    if 'entity_type_uuid' in df.columns:
        entity_types = df['entity_type_uuid'].value_counts()
        print(f"\n  Entity Types Distribution ({len(entity_types)} unique):")
        for uuid, count in entity_types.head(10).items():
            print(f"    {uuid}: {count} records")
        if len(entity_types) > 10:
            print(f"    ... and {len(entity_types) - 10} more")
    
    # Check country_uuid distribution
    if 'country_uuid' in df.columns:
        countries = df['country_uuid'].value_counts()
        print(f"\n  Country Distribution ({len(countries)} unique):")
        for uuid, count in countries.head(10).items():
            print(f"    {uuid}: {count} records")
        if len(countries) > 10:
            print(f"    ... and {len(countries) - 10} more")
    
    # Check identification_number format
    if 'identification_number' in df.columns:
        id_numbers = df['identification_number'].dropna()
        print(f"\n  Identification Numbers:")
        print(f"    Total: {len(id_numbers)}")
        print(f"    Missing: {df['identification_number'].isna().sum()}")
        if len(id_numbers) > 0:
            lengths = id_numbers.astype(str).str.len()
            print(f"    Length range: {lengths.min()} - {lengths.max()}")
            print(f"    Sample IDs: {', '.join(id_numbers.head(5).astype(str).tolist())}")
    
    # Check sex distribution
    if 'sex' in df.columns:
        sex_dist = df['sex'].value_counts()
        print(f"\n  Sex Distribution:")
        for sex, count in sex_dist.items():
            print(f"    {sex}: {count} records")
    
    # Check is_active, is_emploee, was_emploee
    boolean_cols = ['is_active', 'is_emploee', 'was_emploee', 'pension_scheme']
    for col in boolean_cols:
        if col in df.columns:
            vals = df[col].value_counts(dropna=False)
            print(f"\n  {col}:")
            for val, count in vals.items():
                print(f"    {val}: {count} records")
    
    # Show first 5 complete records
    print(f"\n📝 SAMPLE RECORDS (first 5):")
    print("-"*90)
    for idx in range(min(5, len(df))):
        row = df.iloc[idx]
        print(f"\nRecord #{idx + 1}:")
        print(f"  Name: {row.get('name', 'N/A')}")
        print(f"  ID Number: {row.get('identification_number', 'N/A')}")
        print(f"  Entity Type UUID: {row.get('entity_type_uuid', 'N/A')}")
        print(f"  Country UUID: {row.get('country_uuid', 'N/A')}")
        print(f"  Counteragent UUID: {row.get('counteragent_uuid', 'N/A')}")
        print(f"  Sex: {row.get('sex', 'N/A')}")
        print(f"  Address: {str(row.get('address_line_1', 'N/A'))[:60]}")
        print(f"  IBAN: {row.get('iban', 'N/A')}")
        print(f"  Phone: {row.get('phone', 'N/A')}")
        print(f"  Email: {row.get('email', 'N/A')}")
        print(f"  Timestamp: {row.get('ts', 'N/A')}")

# Validation against database schema
print(f"\n{'='*90}")
print("SCHEMA VALIDATION")
print("="*90)

# Expected columns based on counteragents table
expected_columns = {
    'counteragent_uuid': 'UUID - Primary key',
    'name': 'VARCHAR(255) - Required',
    'identification_number': 'VARCHAR(50) - Optional',
    'entity_type_uuid': 'UUID - Foreign key to entity_types',
    'country_uuid': 'UUID - Foreign key to countries',
    'is_active': 'BOOLEAN - Default true',
    'address_line_1': 'TEXT - Optional',
    'address_line_2': 'TEXT - Optional',
    'zip_code': 'VARCHAR(20) - Optional',
    'iban': 'VARCHAR(50) - Optional',
    'swift': 'VARCHAR(20) - Optional',
    'email': 'VARCHAR(255) - Optional',
    'phone': 'VARCHAR(50) - Optional',
    'birth_or_incorporation_date': 'DATE - Optional',
    'director': 'VARCHAR(255) - Optional',
    'director_id': 'VARCHAR(50) - Optional',
}

df_main = pd.read_excel('templates/counteragent_import_template.xlsx', sheet_name='Counteragent')

print("\n✅ REQUIRED FIELDS:")
for col in ['counteragent_uuid', 'name', 'entity_type_uuid', 'country_uuid']:
    if col in df_main.columns:
        non_null = df_main[col].notna().sum()
        print(f"  ✓ {col}: {non_null}/{len(df_main)} records have values")
    else:
        print(f"  ✗ {col}: MISSING")

print("\n📌 OPTIONAL FIELDS:")
optional_cols = ['identification_number', 'address_line_1', 'iban', 'phone', 'email', 
                 'director', 'director_id', 'birth_or_incorporation_date']
for col in optional_cols:
    if col in df_main.columns:
        non_null = df_main[col].notna().sum()
        percentage = (non_null / len(df_main) * 100) if len(df_main) > 0 else 0
        print(f"  • {col}: {non_null}/{len(df_main)} ({percentage:.1f}%)")
    else:
        print(f"  • {col}: Not in template")

print("\n⚠️  EXTRA FIELDS (not in database schema):")
extra_cols = set(df_main.columns) - set(expected_columns.keys()) - {'ts', 'sex', 'pension_scheme', 
                                                                      'counteragent', 'oris_id',
                                                                      'internal_number', 'is_emploee', 
                                                                      'was_emploee', 'entity_type', 'country'}
if extra_cols:
    for col in extra_cols:
        print(f"  • {col}")
else:
    print("  None")

print("\n💡 IMPORT READINESS:")
df_main = pd.read_excel('templates/counteragent_import_template.xlsx', sheet_name='Counteragent')
ready_count = df_main[
    df_main['counteragent_uuid'].notna() & 
    df_main['name'].notna() & 
    df_main['entity_type_uuid'].notna() & 
    df_main['country_uuid'].notna()
].shape[0]

print(f"  Total records: {len(df_main)}")
print(f"  Ready to import: {ready_count} ({ready_count/len(df_main)*100:.1f}%)")
print(f"  Missing required data: {len(df_main) - ready_count}")

if ready_count == len(df_main):
    print(f"\n  ✅ All records are ready for import!")
else:
    print(f"\n  ⚠️  {len(df_main) - ready_count} records need review")

print("\n" + "="*90)
