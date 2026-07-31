import subprocess
import os
import pandas as pd

# Database connection params
host = 'db.wlpzfmmwmqbhqsrfmlgg.supabase.co'
user = 'postgres'
database = 'postgres'
password = 'Ice@Erp2024!'

env = os.environ.copy()
env['PGPASSWORD'] = password

print("=" * 100)
print("DATABASE TABLE SCHEMA: GE78BG0000000893486000_BOG_USD")
print("=" * 100)

# Query database for table schema
schema_query = """
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'GE78BG0000000893486000_BOG_USD'
ORDER BY ordinal_position;
"""

result = subprocess.run(
    ['psql', '-h', host, '-U', user, '-d', database, '-c', schema_query],
    capture_output=True,
    text=True,
    env=env
)

print(result.stdout)
if result.stderr and 'warning' not in result.stderr.lower():
    print("Errors:", result.stderr)

# Get row count
print("\n" + "=" * 100)
print("DATABASE TABLE STATISTICS")
print("=" * 100)

count_query = """SELECT COUNT(*) as row_count FROM "GE78BG0000000893486000_BOG_USD";"""
result = subprocess.run(
    ['psql', '-h', host, '-U', user, '-d', database, '-c', count_query],
    capture_output=True,
    text=True,
    env=env
)
print(result.stdout)

# Check for sample data
print("\n" + "=" * 100)
print("SAMPLE DATA FROM DATABASE (First 3 rows)")
print("=" * 100)

sample_query = """SELECT * FROM "GE78BG0000000893486000_BOG_USD" LIMIT 3;"""
result = subprocess.run(
    ['psql', '-h', host, '-U', user, '-d', database, '-c', sample_query],
    capture_output=True,
    text=True,
    env=env
)
print(result.stdout[:2000])  # First 2000 chars

# Now check the Excel file for duplicates
print("\n" + "=" * 100)
print("EXCEL FILE ANALYSIS: BOG USD 2018-2022.xlsx")
print("=" * 100)

file_path = r'Chrome Logs\BOG USD 2018-2022.xlsx'
df = pd.read_excel(file_path, sheet_name='Sheet1')

print(f"\nTotal rows in Excel: {len(df)}")
print(f"Total columns: {len(df.columns)}")

# Check for unique identifiers to detect duplicates
print("\n" + "-" * 100)
print("DUPLICATE CHECK - Using 'საბუთის N' (document number) as unique key:")
print("-" * 100)

doc_numbers = df['საბუთის N'].value_counts()
duplicates = doc_numbers[doc_numbers > 1]

if len(duplicates) > 0:
    print(f"\n⚠️  Found {len(duplicates)} duplicate document numbers in Excel:")
    print(duplicates.head(10).to_string())
else:
    print("\n✓ No duplicates found by document number")

# Check other potential key columns
print("\n" + "-" * 100)
print("UNIQUE VALUE COUNTS:")
print("-" * 100)
print(f"Unique document numbers: {df['საბუთის N'].nunique()}")
print(f"Unique operation IDs: {df['ოპერაციის იდ'].nunique()}")
print(f"Unique Ref numbers: {df['Ref'].nunique()}")
print(f"Unique dates: {df['თარიღი'].nunique()}")

# Check date range
print("\n" + "-" * 100)
print("DATE RANGE:")
print("-" * 100)
from datetime import datetime, timedelta

# Excel date serial to datetime
def excel_date_to_datetime(excel_date):
    if pd.isna(excel_date):
        return None
    return datetime(1900, 1, 1) + timedelta(days=excel_date - 2)

df['Date'] = df['თარიღი'].apply(excel_date_to_datetime)
print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
print(f"\nDate distribution:")
print(df['Date'].dt.year.value_counts().sort_index().to_string())

print("\n" + "=" * 100)
print("END OF ANALYSIS")
print("=" * 100)
