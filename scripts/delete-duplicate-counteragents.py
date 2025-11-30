#!/usr/bin/env python3
"""Delete duplicate counteragents, keeping only specified UUID."""

import os
import psycopg2
import sys

KEEP_UUID = "782a27e6-73b0-4e7d-83e1-21d87cb72359"

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

# Use direct connection without pgbouncer for this operation
if 'pgbouncer=true' in database_url:
    database_url = database_url.replace('6543', '5432').replace('?pgbouncer=true&connection_limit=1', '')
    print("ℹ️  Using direct connection (not pooler) for this operation")

database_url = database_url.split('?')[0]

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print(f"✓ Connected to database")
    print()
    print(f"🎯 Will keep counteragent: {KEEP_UUID}")
    print()
    
    # First, verify the UUID exists
    cursor.execute("""
        SELECT id, name, identification_number, internal_number
        FROM counteragents
        WHERE id::text = %s
    """, (KEEP_UUID,))
    
    keeper = cursor.fetchone()
    
    if not keeper:
        print(f"❌ UUID {KEEP_UUID} not found in database!")
        cursor.close()
        conn.close()
        exit(1)
    
    keeper_id, keeper_name, keeper_id_num, keeper_internal = keeper
    print(f"✓ Found record to keep:")
    print(f"   Name: {keeper_name}")
    print(f"   ID Number: {keeper_id_num}")
    print(f"   Internal Number: {keeper_internal}")
    print()
    
    # Find all duplicates with the same identification_number
    cursor.execute("""
        SELECT id, name, internal_number, created_at
        FROM counteragents
        WHERE identification_number = %s
        AND id::text != %s
        ORDER BY created_at
    """, (keeper_id_num, KEEP_UUID))
    
    duplicates = cursor.fetchall()
    
    if not duplicates:
        print("✅ No duplicates found for this identification number!")
        cursor.close()
        conn.close()
        exit(0)
    
    print(f"⚠️  Found {len(duplicates)} duplicate(s) to delete:")
    print()
    
    for dup_id, dup_name, dup_internal, dup_created in duplicates:
        print(f"   • {dup_id}")
        print(f"     Name: {dup_name}")
        print(f"     Internal: {dup_internal}")
        print(f"     Created: {dup_created}")
        print()
    
    print("=" * 80)
    print()
    
    # Confirm deletion
    if len(sys.argv) > 1 and sys.argv[1] == "--confirm":
        print("🗑️  Deleting duplicates...")
        print()
        
        deleted_count = 0
        for dup_id, dup_name, _, _ in duplicates:
            try:
                cursor.execute("DELETE FROM counteragents WHERE id = %s", (dup_id,))
                conn.commit()
                print(f"   ✓ Deleted {dup_id} ({dup_name})")
                deleted_count += 1
            except Exception as e:
                print(f"   ❌ Error deleting {dup_id}: {e}")
                conn.rollback()
        
        print()
        print(f"✅ Deleted {deleted_count} duplicate counteragent(s)")
        print(f"✓ Kept {KEEP_UUID} ({keeper_name})")
        
    else:
        print("⚠️  DRY RUN - No changes made")
        print()
        print("To actually delete these records, run:")
        print(f"   python scripts/delete-duplicate-counteragents.py --confirm")
    
    cursor.close()
    conn.close()

except psycopg2.OperationalError as e:
    print(f"❌ Connection error: {e}")
    print()
    print("💡 Try using the direct database URL (port 5432) instead of pooler (port 6543)")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
