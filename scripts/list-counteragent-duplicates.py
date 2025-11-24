#!/usr/bin/env python3
"""List all counteragents with their details to find duplicates."""

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
    
    # Find all counteragents, grouped by identification_number
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
            
            # Show all records with this identification_number
            cursor.execute("""
                SELECT id::text, name, internal_number, created_at
                FROM counteragents
                WHERE identification_number = %s
                ORDER BY created_at
            """, (id_num,))
            
            records = cursor.fetchall()
            for i, (uuid, name, internal_num, created) in enumerate(records, 1):
                print(f"   {i}. UUID: {uuid}")
                print(f"      Name: {name}")
                print(f"      Internal: {internal_num}")
                print(f"      Created: {created}")
                print()
            
            print(f"💡 To keep record #{1} and delete others, use:")
            print(f"   UUID: {records[0][0]}")
            print()
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
