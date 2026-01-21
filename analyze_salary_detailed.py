import pandas as pd
import numpy as np

# Read the full dataset
df = pd.read_excel('Salary_Accruals.xlsx', sheet_name='Salary_Accruals')

print("="*70)
print("SALARY ACCRUALS ANALYSIS")
print("="*70)

print(f"\n📊 DATASET OVERVIEW:")
print(f"  Total records: {len(df)}")
print(f"  Total columns: {len(df.columns)}")
print(f"  Date range: {df['Date'].min()} to {df['Date'].max()}")

print(f"\n📅 RECORDS BY MONTH:")
df['YearMonth'] = pd.to_datetime(df['Date']).dt.to_period('M')
monthly = df.groupby('YearMonth').size()
print(monthly.head(12))

print(f"\n💰 SALARY STATISTICS:")
print(f"  Total salary amount: {df['ხელფასი'].sum():,.2f} GEL")
print(f"  Average salary: {df['ხელფასი'].mean():,.2f} GEL")
print(f"  Min salary: {df['ხელფასი'].min():,.2f} GEL")
print(f"  Max salary: {df['ხელფასი'].max():,.2f} GEL")

print(f"\n👥 UNIQUE EMPLOYEES:")
print(f"  Total unique employees: {df['პ.ნ.'].nunique()}")
print(f"  Unique counteragent IDs: {df['Counteragent ID'].nunique()}")

print(f"\n💳 PAYMENT STATUS:")
if 'გადახდილი' in df.columns:
    paid_count = df['გადახდილი'].sum() if df['გადახდილი'].dtype == 'bool' else len(df[df['გადახდილი'] == True])
    print(f"  Paid records: {paid_count}")
    print(f"  Unpaid records: {len(df) - paid_count}")

print(f"\n🏦 FINANCIAL CODES:")
if 'კოდი' in df.columns:
    codes = df['კოდი'].value_counts().head(10)
    print(codes)

print(f"\n🔑 KEY COLUMNS:")
for col in df.columns:
    null_count = df[col].isnull().sum()
    null_pct = (null_count / len(df)) * 100
    print(f"  {col}: {null_pct:.1f}% null")

print(f"\n📋 SAMPLE RECENT RECORDS:")
recent = df.sort_values('Date', ascending=False).head(3)
for idx, row in recent.iterrows():
    print(f"\n  Date: {row['Date']}")
    print(f"    Employee: {row['თანამშრომელი']}")
    print(f"    Salary: {row['ხელფასი']} {row['ვალუტა']}")
    print(f"    Net Amount: {row['ხელზე ასაღები']}")
    print(f"    Paid: {row['გადახდილი']}")
    print(f"    Order ID: {row['Order_ID']}")
