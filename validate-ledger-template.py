#!/usr/bin/env python3
"""
Cross-check payment ledger template against database
- Validate payment IDs exist in payments table
- Check for duplicate payment IDs
- Ensure data consistency
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

print("=" * 80)
print("PAYMENT LEDGER TEMPLATE vs DATABASE VALIDATION")
print("=" * 80)

# Load template
try:
    df = pd.read_excel('templates/paymentledger_import_template.xlsx')
    print(f"\n✓ Template loaded: {len(df)} rows")
except Exception as e:
    print(f"\n✗ Error loading template: {e}")
    exit(1)

# Connect to database
try:
    # Use production Supabase database
    db_url = os.getenv('DATABASE_URL')
    
    # Check if we're using local or production
    if 'localhost' in db_url or '127.0.0.1' in db_url:
        print("⚠️  WARNING: Using LOCAL database. Set DATABASE_URL to Supabase production URL.")
    
    if '?schema=' in db_url:
        db_url = db_url.split('?schema=')[0]
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print(f"✓ Database connected: {db_url.split('@')[1].split('/')[0] if '@' in db_url else 'local'}")
except Exception as e:
    print(f"✗ Database connection error: {e}")
    exit(1)

# 1. Check if payment IDs exist in database
print("\n1. PAYMENT ID VALIDATION AGAINST DATABASE")
print("-" * 80)

unique_payment_ids = df['paymentId'].dropna().unique()
print(f"Unique payment IDs in template: {len(unique_payment_ids)}")

# Query existing payment IDs using the payment_id column (format: 6_2_6)
cur.execute("SELECT payment_id FROM payments WHERE is_active = true")
db_payment_ids = set([row[0] for row in cur.fetchall()])
print(f"Active payment IDs in database: {len(db_payment_ids)}")

# Sample of payment IDs from both sources
print(f"\nSample template IDs (first 5): {list(unique_payment_ids)[:5]}")
print(f"Sample database IDs (first 5): {list(db_payment_ids)[:5]}")

# Check which payment IDs from template exist in database
missing_payment_ids = set(unique_payment_ids) - db_payment_ids
existing_payment_ids = set(unique_payment_ids) & db_payment_ids

print(f"\n✓ Valid payment IDs (exist in DB): {len(existing_payment_ids)}")
print(f"✗ Invalid payment IDs (NOT in DB): {len(missing_payment_ids)}")

if existing_payment_ids:
    print(f"\nFirst 10 existing payment IDs:")
    for pid in list(existing_payment_ids)[:10]:
        print(f"  - {pid}")

if missing_payment_ids:
    print(f"\nFirst 10 missing payment IDs:")
    for pid in list(missing_payment_ids)[:10]:
        print(f"  - {pid}")
    if len(missing_payment_ids) > 10:
        print(f"  ... and {len(missing_payment_ids) - 10} more")

# 2. Check for existing ledger entries
print("\n2. EXISTING LEDGER ENTRIES CHECK")
print("-" * 80)

existing_ledger = {}

if existing_payment_ids:
    # Query existing ledger entries for these payment IDs
    placeholders = ','.join(['%s'] * len(existing_payment_ids))
    query = f"""
        SELECT payment_id, COUNT(*) as entry_count
        FROM payments_ledger
        GROUP BY payment_id
        HAVING payment_id IN ({placeholders})
    """
    cur.execute(query, tuple(existing_payment_ids))
    existing_ledger = dict(cur.fetchall())
    
    print(f"Payment IDs that already have ledger entries: {len(existing_ledger)}")
    
    if existing_ledger:
        print(f"\nTop 10 payment IDs with existing entries:")
        for pid, count in list(existing_ledger.items())[:10]:
            print(f"  - {pid}: {count} entries")
else:
    print("No valid payment IDs found in template")

# 3. Check for duplicate entries in template
print("\n3. DUPLICATE DETECTION IN TEMPLATE")
print("-" * 80)

# Group by payment_id and effectiveDate to find potential duplicates
duplicates = df.groupby(['paymentId', 'effectiveDate']).size()
duplicates = duplicates[duplicates > 1]

if len(duplicates) > 0:
    print(f"⚠ Found {len(duplicates)} duplicate combinations (same payment_id + effectiveDate)")
    print(f"\nFirst 10 duplicates:")
    for (pid, date), count in list(duplicates.items())[:10]:
        print(f"  - {pid} on {date}: {count} entries")
else:
    print(f"✓ No duplicates found (unique payment_id + effectiveDate combinations)")

# 4. Check payment details for consolidation
print("\n4. PAYMENT DETAILS FOR CONSOLIDATION")
print("-" * 80)

if existing_payment_ids:
    # Get payment details
    placeholders = ','.join(['%s'] * min(10, len(existing_payment_ids)))
    sample_ids = list(existing_payment_ids)[:10]
    
    query = f"""
        SELECT 
            p.payment_id,
            proj.project_index,
            ca.name as counteragent,
            fc.validation as financial_code,
            curr.code as currency
        FROM payments p
        LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
        LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
        WHERE p.payment_id IN ({placeholders})
        LIMIT 10
    """
    
    cur.execute(query, tuple(sample_ids))
    results = cur.fetchall()
    
    print(f"Sample payment details (first 10):")
    for row in results:
        pid, project, counteragent, fc, currency = row
        print(f"  {pid}")
        print(f"    Project: {project}")
        print(f"    Counteragent: {counteragent}")
        print(f"    Financial Code: {fc}")
        print(f"    Currency: {currency}")
        print()

# 5. Summary and recommendations
print("\n" + "=" * 80)
print("SUMMARY & RECOMMENDATIONS")
print("=" * 80)

issues = []
warnings = []

if missing_payment_ids:
    issues.append(f"✗ {len(missing_payment_ids)} payment IDs in template don't exist in database")

if len(duplicates) > 0:
    warnings.append(f"⚠ {len(duplicates)} duplicate entries in template (same payment + date)")

if len(existing_ledger) > 0:
    warnings.append(f"⚠ {len(existing_ledger)} payment IDs already have ledger entries")

if issues:
    print("\n🔴 CRITICAL ISSUES:")
    for issue in issues:
        print(f"  {issue}")
    print("\n  ACTION REQUIRED: Remove or fix invalid payment IDs before importing")

if warnings:
    print("\n🟡 WARNINGS:")
    for warning in warnings:
        print(f"  {warning}")
    print("\n  ACTION REQUIRED: Review and consolidate data before importing")

if not issues and not warnings:
    print("\n✓ Template validation passed! Safe to import.")
else:
    print(f"\n⚠ Found {len(issues)} critical issue(s) and {len(warnings)} warning(s)")
    print("  Review and fix issues before proceeding with import")

print("=" * 80)

cur.close()
conn.close()
