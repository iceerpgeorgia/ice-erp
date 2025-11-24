#!/usr/bin/env python3
"""Apply unique constraint to counteragent_uuid in production."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

if 'pgbouncer=true' in database_url:
    database_url = database_url.replace('6543', '5432').replace('?pgbouncer=true&connection_limit=1', '')
    print("ℹ️  Using direct connection (not pooler)")

database_url = database_url.split('?')[0]

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print("✓ Connected to database")
    print()
    
    # Check for existing duplicates first
    cursor.execute("""
        SELECT counteragent_uuid, COUNT(*) as count
        FROM counteragents
        WHERE counteragent_uuid IS NOT NULL
        GROUP BY counteragent_uuid
        HAVING COUNT(*) > 1
    """)
    
    duplicates = cursor.fetchall()
    
    if duplicates:
        print(f"❌ Found {len(duplicates)} duplicate counteragent_uuid value(s)!")
        print("   Cannot add UNIQUE constraint with duplicates present.")
        print()
        for uuid, count in duplicates:
            print(f"   {uuid}: {count} records")
        print()
        print("Please remove duplicates first before adding constraint.")
        cursor.close()
        conn.close()
        exit(1)
    
    print("✓ No duplicate counteragent_uuid values found")
    print()
    
    # Add the unique constraint
    print("📝 Adding UNIQUE constraint to counteragent_uuid...")
    
    cursor.execute("""
        ALTER TABLE counteragents 
        ADD CONSTRAINT counteragents_counteragent_uuid_key 
        UNIQUE (counteragent_uuid);
    """)
    
    conn.commit()
    
    print("✅ Successfully added UNIQUE constraint!")
    print()
    print("🔒 From now on, duplicate counteragent_uuid values cannot be inserted.")
    
    # Verify
    cursor.execute("""
        SELECT conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'counteragents'::regclass
        AND conname = 'counteragents_counteragent_uuid_key'
    """)
    
    result = cursor.fetchone()
    if result:
        print()
        print("✓ Constraint verified:")
        print(f"   Name: {result[0]}")
        print(f"   Definition: {result[1]}")
    
    cursor.close()
    conn.close()

except psycopg2.errors.UniqueViolation as e:
    print(f"❌ Duplicate values exist: {e}")
    print("   Remove duplicates first.")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
