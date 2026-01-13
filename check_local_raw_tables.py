#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Check BOG GEL raw tables and statistics
"""
import psycopg2
from dotenv import dotenv_values

# Load environment
env = dotenv_values('.env.local')
db_url = env['DATABASE_URL'].split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("📋 Checking BOG GEL raw tables in LOCAL database...\n")

# Check what tables exist
cur.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname='public' AND tablename LIKE 'bog_gel_raw%'
    ORDER BY tablename
""")
tables = cur.fetchall()

if tables:
    print("Found BOG GEL raw tables:")
    for table in tables:
        table_name = table[0]
        print(f"\n📊 {table_name}:")
        
        # Get total count
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        total = cur.fetchone()[0]
        print(f"   Total records: {total}")
        
        # Check if is_processed column exists
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}' AND column_name = 'is_processed'
        """)
        if cur.fetchone():
            cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE is_processed = FALSE")
            unprocessed = cur.fetchone()[0]
            print(f"   Unprocessed: {unprocessed}")
            print(f"   Processed: {total - unprocessed}")
        
        # Get account_uuid if exists
        cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}' AND column_name = 'account_uuid'
        """)
        if cur.fetchone():
            cur.execute(f"SELECT DISTINCT account_uuid FROM {table_name} LIMIT 5")
            accounts = cur.fetchall()
            if accounts:
                print(f"   Account UUIDs: {len(accounts)} distinct")
                for acc in accounts[:3]:
                    print(f"      - {acc[0]}")
else:
    print("❌ No BOG GEL raw tables found in LOCAL database")
    print("\n💡 Suggestion: You may need to import XML data first or copy data from Supabase")

cur.close()
conn.close()
