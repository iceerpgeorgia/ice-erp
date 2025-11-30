#!/usr/bin/env python3
"""Delete duplicate counteragent, keeping the one with specified counteragent_uuid."""

import os
import psycopg2
import sys

KEEP_COUNTERAGENT_UUID = "782a27e6-73b0-4e7d-83e1-21d87cb72359"

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

# Use direct connection
if 'pgbouncer=true' in database_url:
    database_url = database_url.replace('6543', '5432').replace('?pgbouncer=true&connection_limit=1', '')
    print("ℹ️  Using direct connection (not pooler)")

database_url = database_url.split('?')[0]

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print(f"✓ Connected to database")
    print()
    print(f"🎯 Will keep counteragent with counteragent_uuid: {KEEP_COUNTERAGENT_UUID}")
    print()
    
    # Find the record to keep
    cursor.execute("""
        SELECT id, name, identification_number, internal_number, created_at
        FROM counteragents
        WHERE counteragent_uuid = %s
    """, (KEEP_COUNTERAGENT_UUID,))
    
    keeper = cursor.fetchone()
    
    if not keeper:
        print(f"❌ Counteragent UUID {KEEP_COUNTERAGENT_UUID} not found!")
        cursor.close()
        conn.close()
        exit(1)
    
    keeper_id, keeper_name, keeper_id_num, keeper_internal, keeper_created = keeper
    print(f"✓ Found record to KEEP:")
    print(f"   ID: {keeper_id}")
    print(f"   Name: {keeper_name}")
    print(f"   ID Number: {keeper_id_num}")
    print(f"   Internal: {keeper_internal}")
    print(f"   Created: {keeper_created}")
    print()
    
    # Find all duplicates with same identification_number
    cursor.execute("""
        SELECT id, name, internal_number, created_at, counteragent_uuid
        FROM counteragents
        WHERE identification_number = %s
        AND id != %s
        ORDER BY created_at
    """, (keeper_id_num, keeper_id))
    
    duplicates = cursor.fetchall()
    
    if not duplicates:
        print("✅ No duplicates found!")
        cursor.close()
        conn.close()
        exit(0)
    
    print(f"⚠️  Found {len(duplicates)} duplicate(s) to DELETE:")
    print()
    
    for dup_id, dup_name, dup_internal, dup_created, dup_uuid in duplicates:
        print(f"   ❌ ID: {dup_id}")
        print(f"      Name: {dup_name}")
        print(f"      Internal: {dup_internal}")
        print(f"      Created: {dup_created}")
        print(f"      Counteragent UUID: {dup_uuid}")
        print()
    
    print("=" * 80)
    print()
    
    # Confirm deletion
    if len(sys.argv) > 1 and sys.argv[1] == "--confirm":
        print("🗑️  DELETING duplicates...")
        print()
        
        deleted_count = 0
        for dup_id, dup_name, _, _, _ in duplicates:
            try:
                cursor.execute("DELETE FROM counteragents WHERE id = %s", (dup_id,))
                conn.commit()
                print(f"   ✓ Deleted ID {dup_id} ({dup_name})")
                deleted_count += 1
            except Exception as e:
                print(f"   ❌ Error deleting ID {dup_id}: {e}")
                conn.rollback()
        
        print()
        print(f"✅ Successfully deleted {deleted_count} duplicate(s)")
        print(f"✓ Kept ID {keeper_id} with counteragent_uuid {KEEP_COUNTERAGENT_UUID}")
        
    else:
        print("⚠️  DRY RUN - No changes made")
        print()
        print("To actually delete these records, run:")
        print(f"   python scripts/delete-counteragent-duplicate.py --confirm")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
