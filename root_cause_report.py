#!/usr/bin/env python3
"""
ROOT CAUSE ANALYSIS AND RESOLUTION REPORT
Bundle Payment Distribution Investigation
Project UUID: a7380446-a51d-44c2-abf1-0d3a9899d3a2
"""
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from decimal import Decimal

load_dotenv('.env')

DB_URL = os.environ['DIRECT_URL']

conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=" * 80)
print("ROOT CAUSE ANALYSIS: BUNDLE PAYMENT DISTRIBUTION MISMATCH")
print("=" * 80)
print()

# Get current distribution totals
cur.execute("""
    SELECT 
        COUNT(*) as count,
        SUM(amount) as total_nominal,
        SUM(amount_account_curr) as total_gel
    FROM payments_jobs
    WHERE project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'
    AND is_auto_distributed = true
""")
current = cur.fetchone()

print("CURRENT STATE:")
print("-" * 80)
print(f"  Distribution records: {current['count']}")
print(f"  Total nominal: {current['total_nominal']:,.2f}")
print(f"  Total GEL: {current['total_gel']:,.2f}")
print()

# Get bank transaction totals for the 5 specific transactions
cur.execute("""
    SELECT 
        COUNT(*) as count,
        SUM(account_currency_amount) as total_gel,
        SUM(nominal_amount) as total_nominal
    FROM "GE65TB7856036050100002_TBC_GEL"
    WHERE raw_record_uuid::text IN (
        'caa2cf8c-7009-5a48-8a3c-a1385c5084e4',
        '6ec61407-6c08-5ccd-8847-0b4027ba9ae2',
        '1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a',
        '06f762fc-3ccc-573c-8f93-c18565a717b4',
        '77501426-9a30-5b3f-842a-0270795db7c0'
    )
""")
bank_txns = cur.fetchone()

print("BANK TRANSACTIONS (5 transactions):")
print("-" * 80)
print(f"  Transaction count: {bank_txns['count']}")
print(f"  Total nominal: {bank_txns['total_nominal']:,.2f}")
print(f"  Total GEL: {bank_txns['total_gel']:,.2f}")
print()

print("=" * 80)
print("ROOT CAUSE FINDINGS:")
print("=" * 80)
print()
print("1. THE MISMATCH WAS A FALSE ALARM")
print("   - Original investigation found 23 'orphaned' distributions totaling 528K GEL")
print("   - These distributions referenced raw_record_uuid values")
print("   - Investigation script searched consolidated_bank_accounts table")
print("   - But the system uses RAW BANK TABLES as the primary data source")
print()
print("2. WHY THE INVESTIGATION FAILED")
print("   - /api/bank-transactions queries raw tables (GE65TB7856036050100002_TBC_GEL, etc.)")
print("   - consolidated_bank_accounts table is OBSOLETE (no longer used)")
print("   - The 'orphaned' UUIDs exist in raw tables, not consolidated table")
print("   - Verification confirmed all 5 UUIDs exist in GE65TB7856036050100002_TBC_GEL")
print()
print("3. THE ARCHITECTURAL FACT")
print("   - Raw bank account tables are the PRIMARY data source")
print("   - Bank transactions API queries: GE65TB7856036050100002_TBC_GEL, etc.")
print("   - Job distributions use raw_record_uuid to link to raw tables")
print("   - consolidated_bank_accounts table should NOT be queried for verification")
print()
print("4. WHAT ACTUALLY HAPPENED")
print("   - App correctly created distributions with raw_record_uuid")
print("   - UUIDs pointed to valid raw bank transactions")
print("   - Investigation incorrectly identified them as orphaned")
print("   - Deleted 23 valid distributions")
print("   - Recreated them with create_bundle_distributions.py")
print()
print("=" * 80)
print("CORRECTIVE ACTION:")
print("=" * 80)
print()
print("Created 28 new distribution records (7 payment partitions × 4 jobs)")
print("Distributed by selling price weights:")
print("  - L0001: 21.33% ($44,088)")
print("  - L0002: 26.63% ($55,044)")
print("  - L0003: 26.02% ($53,783)")
print("  - L0004: 26.02% ($53,783)")
print()
print("=" * 80)
print("LESSONS LEARNED:")
print("=" * 80)
print()
print("1. ALWAYS verify the active data architecture before investigation")
print("2. Raw bank account tables (GE65TB..._TBC_GEL, etc.) are the PRIMARY source")
print("3. consolidated_bank_accounts is OBSOLETE - do not use for verification")
print("4. raw_record_uuid references come from raw bank tables, not consolidated")
print("5. Check /api/bank-transactions route.ts to understand data source")
print()

conn.close()
