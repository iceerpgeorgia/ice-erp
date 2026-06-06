#!/usr/bin/env python3
"""
DROP consolidated_bank_accounts TABLE FROM SUPABASE
This table is obsolete - raw bank account tables are now the primary data source
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env')

# Use REMOTE_DATABASE_URL for Supabase
SUPABASE_URL = os.environ.get('REMOTE_DATABASE_URL') or os.environ.get('DATABASE_URL')

if not SUPABASE_URL:
    print("❌ ERROR: No database URL found")
    print("   Set REMOTE_DATABASE_URL or DATABASE_URL in .env")
    exit(1)

print("=" * 80)
print("DROP consolidated_bank_accounts TABLE FROM SUPABASE")
print("=" * 80)
print()
print("⚠️  WARNING: This will permanently delete the consolidated_bank_accounts table")
print("   from Supabase, along with all its data and indexes.")
print()
print("   Rationale:")
print("   - Raw bank account tables (GE65TB..._TBC_GEL, etc.) are the primary source")
print("   - /api/bank-transactions queries raw tables via UNION")
print("   - consolidated_bank_accounts is no longer written to or read from")
print()

# Check table exists and row count
try:
    conn = psycopg2.connect(SUPABASE_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            COUNT(*) as row_count,
            pg_size_pretty(pg_total_relation_size('consolidated_bank_accounts')) as total_size
        FROM consolidated_bank_accounts
    """)
    
    result = cur.fetchone()
    if result:
        row_count, table_size = result
        print(f"📊 Current table stats:")
        print(f"   Rows: {row_count:,}")
        print(f"   Size: {table_size}")
        print()
    
    conn.close()
    
except Exception as e:
    print(f"⚠️  Could not read table stats: {e}")
    print()

# Confirmation
response = input("Type 'DROP TABLE' to confirm deletion: ")

if response != 'DROP TABLE':
    print("\n❌ Aborted. Table not dropped.")
    exit(0)

print()
print("🗑️  Dropping table and all dependencies...")
print()

try:
    conn = psycopg2.connect(SUPABASE_URL)
    cur = conn.cursor()
    
    # Drop the table CASCADE (removes all foreign keys, indexes, etc.)
    cur.execute("DROP TABLE IF EXISTS consolidated_bank_accounts CASCADE")
    
    conn.commit()
    conn.close()
    
    print("✅ SUCCESS: consolidated_bank_accounts table dropped from Supabase")
    print()
    print("Next steps:")
    print("  1. Remove ConsolidatedBankAccount model from prisma/schema.prisma")
    print("  2. Remove references from app/api/projects/route.ts")
    print("  3. Delete app/api/bank-transactions/[id]/route-supabase.ts")
    print("  4. Run: pnpm prisma generate")
    print()
    
except Exception as e:
    print(f"❌ ERROR: {e}")
    exit(1)
