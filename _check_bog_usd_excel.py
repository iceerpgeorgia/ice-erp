import pandas as pd
from datetime import datetime, timedelta
import traceback

print("=" * 100)
print("EXCEL FILE ANALYSIS: BOG USD 2018-2022.xlsx")
print("=" * 100)

try:
    file_path = r'Chrome Logs\BOG USD 2018-2022.xlsx'
    df = pd.read_excel(file_path, sheet_name='Sheet1')

    print(f"\nTotal rows in Excel: {len(df):,}")
    print(f"Total columns: {len(df.columns)}")

    print(f"\nColumn Headers ({len(df.columns)} columns):")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2d}. {col}")

    # Check for unique identifiers to detect duplicates
    print("\n" + "=" * 100)
    print("DUPLICATE CHECK - Analyzing potential key columns:")
    print("=" * 100)

    # Document number is the primary key in bank statements
    doc_col = 'საბუთის N'
    print(f"\nPrimary Key: '{doc_col}'")
    print(f"Total unique document numbers: {df[doc_col].nunique():,}")
    print(f"Total rows: {len(df):,}")
    
    if df[doc_col].nunique() < len(df):
        print("\n⚠️  WARNING: Document numbers are NOT unique (duplicates detected)")
        dup_counts = df[doc_col].value_counts()
        duplicates = dup_counts[dup_counts > 1]
        print(f"\nFound {len(duplicates)} document numbers appearing multiple times:")
        print("\nTop 15 duplicates:")
        for doc_num, count in duplicates.head(15).items():
            print(f"  '{doc_num}': {count} times")
            # Show sample rows for this document
            sample = df[df[doc_col] == doc_num][['თარიღი', 'საბუთის N', 'დამატებითი ინფორმაცია', 'თანხა']].head(2)
            for idx, row in sample.iterrows():
                print(f"    - Date: {row['თარიღი']}, Amount: {row['თანხა']}, Info: {row['დამატებითი ინფორმაცია']}")
    else:
        print("✓ All document numbers are unique (no duplicates)")

    # Check operation IDs
    print(f"\n" + "-" * 100)
    print(f"Alternative Key: 'ოპერაციის იდ' (Operation ID)")
    print(f"Total unique operation IDs: {df['ოპერაციის იდ'].nunique():,}")
    
    if df['ოპერაციის იდ'].nunique() < len(df):
        print("⚠️  WARNING: Operation IDs are NOT unique")
        op_counts = df['ოპერაციის იდ'].value_counts()
        op_dups = op_counts[op_counts > 1]
        print(f"Found {len(op_dups)} operation IDs appearing multiple times")
    else:
        print("✓ All operation IDs are unique")

    # Check Ref column
    print(f"\n" + "-" * 100)
    print(f"Alternative Key: 'Ref' (Reference)")
    print(f"Total unique Ref values: {df['Ref'].nunique():,}")
    
    if df['Ref'].nunique() < len(df):
        print("⚠️  WARNING: Ref values are NOT unique")
        ref_counts = df['Ref'].value_counts()
        ref_dups = ref_counts[ref_counts > 1]
        print(f"Found {len(ref_dups)} Ref values appearing multiple times")
    else:
        print("✓ All Ref values are unique")

    # Check date range
    print(f"\n" + "=" * 100)
    print("DATE RANGE ANALYSIS:")
    print("=" * 100)

    # Excel date serial to datetime
    def excel_date_to_datetime(excel_date):
        if pd.isna(excel_date):
            return None
        return datetime(1900, 1, 1) + timedelta(days=excel_date - 2)

    df['Date'] = df['თარიღი'].apply(excel_date_to_datetime)
    print(f"\nDate range: {df['Date'].min().strftime('%Y-%m-%d')} to {df['Date'].max().strftime('%Y-%m-%d')}")
    print(f"Span: {(df['Date'].max() - df['Date'].min()).days} days")
    
    print(f"\nTransactions per year:")
    year_counts = df['Date'].dt.year.value_counts().sort_index()
    for year, count in year_counts.items():
        print(f"  {year}: {count:,} transactions")

    # Check for NULL values
    print(f"\n" + "=" * 100)
    print("NULL VALUES CHECK:")
    print("=" * 100)
    
    null_counts = df.isnull().sum()
    cols_with_nulls = null_counts[null_counts > 0].sort_values(ascending=False)
    
    if len(cols_with_nulls) > 0:
        print(f"\nColumns with NULL values (showing top 10):")
        for col, count in cols_with_nulls.head(10).items():
            pct = (count / len(df)) * 100
            print(f"  {col}: {count:,} NULLs ({pct:.1f}%)")
    else:
        print("No NULL values found")

    # Check data types
    print(f"\n" + "=" * 100)
    print("DATA TYPES:")
    print("=" * 100)
    for col in df.columns[:10]:  # Show first 10
        print(f"  {col}: {df[col].dtype}")

    # Summary
    print(f"\n" + "=" * 100)
    print("SUMMARY FOR DATABASE IMPORT:")
    print("=" * 100)
    print(f"✓ File rows ready to import: {len(df):,}")
    print(f"✓ Date range: {df['Date'].min().strftime('%Y-%m-%d')} to {df['Date'].max().strftime('%Y-%m-%d')}")
    print(f"✓ Key column options:")
    print(f"    1. 'საბუთის N' (Document #) - {df['საბუთის N'].nunique():,} unique")
    print(f"    2. 'ოპერაციის იდ' (Operation ID) - {df['ოპერაციის იდ'].nunique():,} unique")
    print(f"    3. 'Ref' - {df['Ref'].nunique():,} unique")

except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()

print(f"\n" + "=" * 100)
print("END OF ANALYSIS")
print("=" * 100)
