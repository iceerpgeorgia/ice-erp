#!/usr/bin/env python3
"""List counteragent duplicates showing UUID column."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

# Use direct connection
if 'pgbouncer=true' in database_url:
    database_url = database_url.replace('6543', '5432').replace('?pgbouncer=true&connection_limit=1', '')

database_url = database_url.split('?')[0]

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print("✓ Connected to database")
    print()
    
    # First, check what columns exist
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'counteragents' 
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    print("📋 Table columns:")
    for col_name, col_type in columns:
        print(f"   {col_name}: {col_type}")
    print()
    
    # Find duplicates with UUID column
    cursor.execute("""
        SELECT 
            identification_number,
            COUNT(*) as count
        FROM counteragents
        WHERE identification_number IS NOT NULL 
        AND identification_number != ''
        GROUP BY identification_number
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    """)
    
    duplicates = cursor.fetchall()
    
    if not duplicates:
        print("✅ No duplicate identification numbers found!")
    else:
        print(f"⚠️  Found {len(duplicates)} identification number(s) with duplicates:")
        print()
        
        for id_num, count in duplicates:
            print("=" * 80)
            print(f"📋 ID Number: {id_num} ({count} records)")
            print()
            
            # Show all records
            cursor.execute("""
                SELECT id, name, internal_number, created_at, 
                       country_uuid, entity_type_uuid, counteragent_uuid
                FROM counteragents
                WHERE identification_number = %s
                ORDER BY created_at
            """, (id_num,))
            
            records = cursor.fetchall()
            for i, (id_val, name, internal_num, created, country_uuid, entity_type_uuid, counteragent_uuid) in enumerate(records, 1):
                print(f"   {i}. ID: {id_val}")
                print(f"      Name: {name}")
                print(f"      Internal: {internal_num}")
                print(f"      Created: {created}")
                print(f"      Country UUID: {country_uuid}")
                print(f"      Entity Type UUID: {entity_type_uuid}")
                print(f"      Counteragent UUID: {counteragent_uuid}")
                print()
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
