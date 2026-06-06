#!/usr/bin/env python3
"""
Search ALL tables for specific bundle payment IDs.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

payment_ids = [
    '39dbcb_5e_a9dccc',
    '51a575_51_bcfcf5',
    'b993e2_ba_b36a2b'
]

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"SEARCH ALL TABLES FOR BUNDLE PAYMENT IDs")
print(f"{'='*80}\n")

# Get all tables with payment_id column
cur.execute("""
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'payment_id'
    ORDER BY table_name
""")

tables = [row['table_name'] for row in cur.fetchall()]

print(f"Tables with payment_id column: {len(tables)}\n")
for table in tables:
    print(f"  - {table}")

print(f"\n{'='*80}")
print(f"Searching for payment IDs in each table...")
print(f"{'='*80}\n")

for table in tables:
    for payment_id in payment_ids:
        try:
            cur.execute(f"""
                SELECT COUNT(*) as cnt
                FROM {table}
                WHERE payment_id = %s
            """, (payment_id,))
            
            result = cur.fetchone()
            if result and result['cnt'] > 0:
                print(f"✓ FOUND in {table}: {payment_id} ({result['cnt']} rows)")
                
                # Get sample data
                cur.execute(f"""
                    SELECT *
                    FROM {table}
                    WHERE payment_id = %s
                    LIMIT 3
                """, (payment_id,))
                
                samples = cur.fetchall()
                if samples:
                    print(f"  Sample columns: {list(samples[0].keys())[:10]}")
                    print()
        except Exception as e:
            # Skip tables that error (e.g., partitioned tables)
            pass

# Also check in Supabase (remote DB) if SUPABASE_URL exists
if 'SUPABASE_URL' in os.environ and 'SUPABASE_SERVICE_KEY' in os.environ:
    print(f"\n{'='*80}")
    print(f"Checking Supabase tables...")
    print(f"{'='*80}\n")
    
    import urllib.parse
    
    # Build Supabase connection string
    supabase_url = os.environ['SUPABASE_URL']
    # Extract project ref from URL (https://xxx.supabase.co)
    project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '')
    
    # Try to connect to Supabase
    try:
        supabase_conn_str = f"postgresql://postgres.{project_ref}:{urllib.parse.quote_plus(os.environ['SUPABASE_SERVICE_KEY'])}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
        supabase_conn = psycopg2.connect(supabase_conn_str)
        supabase_cur = supabase_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Check bog_gel_raw tables
        for table_name in ['bog_gel_raw', 'bog_gel_raw_2024', 'bog_gel_raw_2025', 'bog_gel_raw_2026']:
            for payment_id in payment_ids:
                try:
                    supabase_cur.execute(f"""
                        SELECT COUNT(*) as cnt
                        FROM {table_name}
                        WHERE payment_id = %s
                    """, (payment_id,))
                    
                    result = supabase_cur.fetchone()
                    if result and result['cnt'] > 0:
                        print(f"✓ FOUND in Supabase {table_name}: {payment_id} ({result['cnt']} rows)")
                except Exception as e:
                    pass
        
        supabase_conn.close()
    except Exception as e:
        print(f"  Could not connect to Supabase: {e}")

conn.close()
print(f"\n{'='*80}\n")
