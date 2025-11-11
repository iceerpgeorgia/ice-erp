import pandas as pd
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("COUNTERAGENTS TEMPLATE ANALYSIS")
print("="*80)

# Analyze root template
print("\n📄 FILE: counteragents_template.xlsx (project root)")
print("-"*80)

try:
    df = pd.read_excel('counteragents_template.xlsx')
    
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    
    print(f"\n📋 COLUMN STRUCTURE ({len(df.columns)} columns):")
    for i, col in enumerate(df.columns, 1):
        dtype = df[col].dtype
        non_null = df[col].notna().sum()
        null_count = df[col].isna().sum()
        print(f"  {i:2d}. {col:<40} | Type: {str(dtype):<10} | Non-null: {non_null:4d} | Nulls: {null_count:4d}")
    
    if len(df) > 0:
        print(f"\n📊 SAMPLE DATA (first 3 rows):")
        print("-"*80)
        for i, row in df.head(3).iterrows():
            print(f"\nRow {i+1}:")
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    print(f"  {col}: [NULL]")
                else:
                    print(f"  {col}: {value}")
    
    print(f"\n📈 DATA STATISTICS:")
    print(f"  Empty template: {'YES' if len(df) == 0 else 'NO'}")
    print(f"  Sample rows: {len(df)}")
    
    # Check for required fields based on counteragents table schema
    required_fields = [
        'name', 
        'identification_number', 
        'entity_type', 
        'country',
        'is_active'
    ]
    
    print(f"\n✅ REQUIRED FIELD CHECK:")
    for field in required_fields:
        # Check various possible column names
        found = False
        matching_cols = [col for col in df.columns if field.lower() in col.lower()]
        if matching_cols:
            print(f"  ✓ {field}: Found as '{matching_cols[0]}'")
            found = True
        else:
            print(f"  ✗ {field}: NOT FOUND")
    
    # Check for optional fields
    optional_fields = [
        'address',
        'contact_person',
        'phone',
        'email',
        'bank_account',
        'bank_name'
    ]
    
    print(f"\n📌 OPTIONAL FIELD CHECK:")
    for field in optional_fields:
        matching_cols = [col for col in df.columns if field.lower() in col.lower()]
        if matching_cols:
            print(f"  ✓ {field}: Found as '{matching_cols[0]}'")
        else:
            print(f"  - {field}: Not included")

except FileNotFoundError:
    print("  ❌ File not found in project root")

# Check templates folder
print("\n" + "="*80)
print("📄 FILE: templates/counteragent_import_template.xlsx")
print("-"*80)

try:
    df2 = pd.read_excel('templates/counteragent_import_template.xlsx')
    
    print(f"Total rows: {len(df2)}")
    print(f"Total columns: {len(df2.columns)}")
    
    print(f"\n📋 COLUMN STRUCTURE ({len(df2.columns)} columns):")
    for i, col in enumerate(df2.columns, 1):
        dtype = df2[col].dtype
        non_null = df2[col].notna().sum()
        null_count = df2[col].isna().sum()
        print(f"  {i:2d}. {col:<40} | Type: {str(dtype):<10} | Non-null: {non_null:4d} | Nulls: {null_count:4d}")
    
    if len(df2) > 0:
        print(f"\n📊 SAMPLE DATA (first 3 rows):")
        print("-"*80)
        for i, row in df2.head(3).iterrows():
            print(f"\nRow {i+1}:")
            for col in df2.columns:
                value = row[col]
                if pd.isna(value):
                    print(f"  {col}: [NULL]")
                else:
                    print(f"  {col}: {value}")

except FileNotFoundError:
    print("  ❌ File not found in templates folder")

print("\n" + "="*80)
print("COMPARISON & RECOMMENDATIONS")
print("="*80)

try:
    # Compare both templates
    if 'df' in locals() and 'df2' in locals():
        print(f"\n📊 TEMPLATE COMPARISON:")
        print(f"  Root template columns: {len(df.columns)}")
        print(f"  Templates folder columns: {len(df2.columns)}")
        
        if list(df.columns) == list(df2.columns):
            print(f"  ✓ Column structures are IDENTICAL")
        else:
            print(f"  ⚠️  Column structures are DIFFERENT")
            
            # Show differences
            root_only = set(df.columns) - set(df2.columns)
            templates_only = set(df2.columns) - set(df.columns)
            
            if root_only:
                print(f"\n  Columns only in ROOT template:")
                for col in root_only:
                    print(f"    - {col}")
            
            if templates_only:
                print(f"\n  Columns only in TEMPLATES folder:")
                for col in templates_only:
                    print(f"    - {col}")
    
    print(f"\n💡 RECOMMENDATIONS:")
    print(f"  1. Use one canonical template (prefer templates/ folder for organization)")
    print(f"  2. Ensure template matches database schema (counteragents table)")
    print(f"  3. Include data validation rules in Excel (dropdowns for entity_type, country)")
    print(f"  4. Add instructions sheet explaining each field")
    print(f"  5. Consider auto-generating template from Prisma schema")

except:
    pass

print("\n" + "="*80)
