#!/usr/bin/env python3
"""
Sanity check for payment ledger template
"""
import pandas as pd
import sys
from datetime import datetime

print("=" * 80)
print("PAYMENT LEDGER TEMPLATE SANITY CHECK")
print("=" * 80)

# Read template
try:
    df = pd.read_excel('templates/paymentledger_import_template.xlsx')
    print(f"\n✓ Template loaded successfully")
except Exception as e:
    print(f"\n✗ Error loading template: {e}")
    sys.exit(1)

# 1. Check columns
print("\n1. COLUMN STRUCTURE")
print("-" * 80)
expected_columns = ['paymentId', 'effectiveDate', 'accrual', 'order', 'comment', 'recordUuid', 'userEmail']
actual_columns = list(df.columns)

print(f"Expected columns: {expected_columns}")
print(f"Actual columns:   {actual_columns}")

missing = set(expected_columns) - set(actual_columns)
extra = set(actual_columns) - set(expected_columns)

if missing:
    print(f"\n✗ Missing columns: {missing}")
else:
    print(f"\n✓ All required columns present")

if extra:
    print(f"⚠ Extra columns: {extra}")

# 2. Check data types
print("\n2. DATA TYPES")
print("-" * 80)
print(df.dtypes)

# 3. Check sample data
print("\n3. SAMPLE DATA (first 3 rows)")
print("-" * 80)
print(df.head(3).to_string())

# 4. Required field validation
print("\n4. REQUIRED FIELD VALIDATION")
print("-" * 80)
required_fields = ['paymentId', 'effectiveDate', 'userEmail']

for col in required_fields:
    nulls = df[col].isna().sum()
    if nulls > 0:
        print(f"✗ {col}: {nulls} null values found")
    else:
        print(f"✓ {col}: No nulls")

# 5. Numeric field validation
print("\n5. NUMERIC FIELD VALIDATION")
print("-" * 80)

# Check accrual
print(f"accrual:")
print(f"  - Min: {df['accrual'].min()}")
print(f"  - Max: {df['accrual'].max()}")
print(f"  - Mean: {df['accrual'].mean():.2f}")
print(f"  - Nulls: {df['accrual'].isna().sum()}")

# Check order
print(f"\norder:")
print(f"  - Min: {df['order'].min()}")
print(f"  - Max: {df['order'].max()}")
print(f"  - Mean: {df['order'].mean():.2f}")
print(f"  - Nulls: {df['order'].isna().sum()}")

# 6. Business logic validation
print("\n6. BUSINESS LOGIC VALIDATION")
print("-" * 80)

# Check if at least one of accrual or order is non-zero
issues = 0
for idx, row in df.iterrows():
    accrual = row['accrual'] if pd.notna(row['accrual']) else 0
    order = row['order'] if pd.notna(row['order']) else 0
    
    if accrual == 0 and order == 0:
        print(f"⚠ Row {idx + 2}: Both accrual and order are 0 or null")
        issues += 1

if issues == 0:
    print("✓ All rows have at least one non-zero value (accrual or order)")
else:
    print(f"⚠ Found {issues} rows with both accrual and order as 0")

# 7. Date validation
print("\n7. DATE VALIDATION")
print("-" * 80)
try:
    # Check if dates are valid
    df['effectiveDate'] = pd.to_datetime(df['effectiveDate'])
    print(f"✓ All dates are valid")
    print(f"  - Earliest: {df['effectiveDate'].min()}")
    print(f"  - Latest: {df['effectiveDate'].max()}")
    
    # Check for future dates
    now = pd.Timestamp.now()
    future_dates = (df['effectiveDate'] > now).sum()
    if future_dates > 0:
        print(f"⚠ {future_dates} rows have future dates")
except Exception as e:
    print(f"✗ Date validation error: {e}")

# 8. UUID validation
print("\n8. UUID VALIDATION")
print("-" * 80)
import re
uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

invalid_uuids = 0
for idx, uuid in enumerate(df['recordUuid']):
    if pd.notna(uuid) and not uuid_pattern.match(str(uuid)):
        print(f"⚠ Row {idx + 2}: Invalid UUID format: {uuid}")
        invalid_uuids += 1

if invalid_uuids == 0:
    print("✓ All UUIDs have valid format")
else:
    print(f"⚠ Found {invalid_uuids} invalid UUID(s)")

# 9. Email validation
print("\n9. EMAIL VALIDATION")
print("-" * 80)
email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

invalid_emails = 0
for idx, email in enumerate(df['userEmail']):
    if pd.notna(email) and not email_pattern.match(str(email)):
        print(f"⚠ Row {idx + 2}: Invalid email format: {email}")
        invalid_emails += 1

if invalid_emails == 0:
    print("✓ All emails have valid format")
else:
    print(f"⚠ Found {invalid_emails} invalid email(s)")

# 10. Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")
print(f"\nTemplate is ready for import. Remember:")
print("  1. paymentId must match existing payment records")
print("  2. At least one of accrual or order must be non-zero")
print("  3. effectiveDate should be a valid date")
print("  4. userEmail must be a valid email address")
print("  5. recordUuid can be left empty (will be auto-generated)")
print("=" * 80)
