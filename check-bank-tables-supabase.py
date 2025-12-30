"""
Check bank tables in Supabase
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

SUPABASE_DB = os.getenv('DATABASE_URL')
if SUPABASE_DB and '?schema=' in SUPABASE_DB:
    SUPABASE_DB = SUPABASE_DB.split('?schema=')[0]

conn = psycopg2.connect(SUPABASE_DB)

with conn.cursor() as cur:
    # List all tables
    cur.execute("""
        SELECT schemaname, tablename, 
               (SELECT COUNT(*) FROM pg_class WHERE relname = tablename) as row_count
        FROM pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename
    """)
    tables = cur.fetchall()
    
    print("\n=== All Tables ===")
    for schema, table, count in tables:
        print(f"{schema}.{table}")
    
    print("\n\n=== Bank-related Tables ===")
    cur.execute("""
        SELECT schemaname, tablename
        FROM pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND (tablename LIKE '%bank%' OR tablename LIKE '%bog%')
        ORDER BY tablename
    """)
    bank_tables = cur.fetchall()
    
    for schema, table in bank_tables:
        cur.execute(f'SELECT COUNT(*) FROM "{schema}"."{table}"')
        count = cur.fetchone()[0]
        print(f"{schema}.{table}: {count} rows")

conn.close()
