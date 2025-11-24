#!/usr/bin/env python3
"""Check entity types and their UUIDs."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

if 'pgbouncer=true' in database_url:
    database_url = database_url.replace('6543', '5432').replace('?pgbouncer=true&connection_limit=1', '')

database_url = database_url.split('?')[0]

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print("✓ Connected to database")
    print()
    
    # Get all entity types with their IDs and UUIDs
    cursor.execute("""
        SELECT id, entity_type_uuid, code, name_en, name_ka
        FROM entity_types
        ORDER BY id
    """)
    
    entity_types = cursor.fetchall()
    
    print("📋 Entity Types in Database:")
    print()
    print(f"{'ID':<8} {'UUID':<40} {'Code':<15} {'Name (EN)':<30} {'Name (KA)'}")
    print("=" * 140)
    
    for id_val, uuid_val, code, name_en, name_ka in entity_types:
        print(f"{id_val:<8} {uuid_val:<40} {code:<15} {name_en:<30} {name_ka}")
    
    print()
    print("=" * 140)
    print()
    
    # Check which one is 5747f8e6-a8a6-4a23-91cc-c427c3a22597
    target_uuid = "5747f8e6-a8a6-4a23-91cc-c427c3a22597"
    
    cursor.execute("""
        SELECT id, entity_type_uuid, code, name_en, name_ka
        FROM entity_types
        WHERE entity_type_uuid = %s
    """, (target_uuid,))
    
    result = cursor.fetchone()
    
    if result:
        id_val, uuid_val, code, name_en, name_ka = result
        print(f"🎯 Target UUID: {target_uuid}")
        print(f"   ID: {id_val}")
        print(f"   Code: {code}")
        print(f"   Name (EN): {name_en}")
        print(f"   Name (KA): {name_ka}")
    else:
        print(f"⚠️  UUID {target_uuid} not found in entity_types table!")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
