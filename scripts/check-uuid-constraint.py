#!/usr/bin/env python3
"""Check if counteragent_uuid unique constraint exists."""

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
    
    # Check for unique constraint on counteragent_uuid
    cursor.execute("""
        SELECT
            con.conname AS constraint_name,
            con.contype AS constraint_type,
            pg_get_constraintdef(con.oid) AS constraint_definition
        FROM pg_constraint con
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        JOIN pg_class cls ON cls.oid = con.conrelid
        WHERE cls.relname = 'counteragents'
        AND con.contype IN ('u', 'p')
        ORDER BY con.conname;
    """)
    
    constraints = cursor.fetchall()
    
    print("📋 Constraints on counteragents table:")
    print()
    
    has_uuid_unique = False
    
    for name, type_code, definition in constraints:
        type_name = "PRIMARY KEY" if type_code == 'p' else "UNIQUE"
        print(f"   {type_name}: {name}")
        print(f"      {definition}")
        
        if 'counteragent_uuid' in definition and type_code == 'u':
            has_uuid_unique = True
        print()
    
    print("=" * 80)
    print()
    
    if has_uuid_unique:
        print("✅ counteragent_uuid has UNIQUE constraint!")
        print("   This prevents duplicate counteragent_uuid values.")
    else:
        print("⚠️  counteragent_uuid does NOT have UNIQUE constraint!")
        print("   Need to add it to prevent duplicates.")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
