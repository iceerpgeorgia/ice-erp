#!/usr/bin/env python3
"""Find and show duplicate identification numbers in counteragents."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("🔍 Checking for duplicate identification numbers...")
print()

# Find duplicates
cursor.execute("""
    SELECT 
        identification_number,
        COUNT(*) as count,
        STRING_AGG(id::text, ', ') as uuids,
        STRING_AGG(name, ', ') as names
    FROM counteragents
    WHERE identification_number IS NOT NULL 
    AND identification_number != ''
    GROUP BY identification_number
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
""")

duplicates = cursor.fetchall()

if not duplicates:
    print("✅ No duplicates found!")
else:
    print(f"⚠️  Found {len(duplicates)} identification number(s) with duplicates:")
    print()
    
    for id_num, count, uuids, names in duplicates:
        print(f"📋 ID Number: {id_num} ({count} records)")
        print(f"   UUIDs: {uuids}")
        print(f"   Names: {names}")
        
        # Show details for each duplicate
        cursor.execute("""
            SELECT id, name, internal_number, created_at
            FROM counteragents
            WHERE identification_number = %s
            ORDER BY created_at
        """, (id_num,))
        
        records = cursor.fetchall()
        print(f"   Details:")
        for uuid, name, internal_num, created in records:
            print(f"      • {uuid}: {name} (Internal: {internal_num}, Created: {created})")
        
        print()

cursor.close()
conn.close()
