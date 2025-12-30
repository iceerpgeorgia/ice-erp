import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

database_url = os.getenv('DATABASE_URL')
if '?schema=' in database_url:
    database_url = database_url.split('?schema=')[0]

try:
    print("Connecting to Supabase...")
    conn = psycopg2.connect(database_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get all tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    all_tables = [row['table_name'] for row in cur.fetchall()]
    
    print("\n=== All Tables ===")
    for table in all_tables:
        print(f"  {table}")
    
    # Find tables that match bank-related patterns
    print("\n=== Bank-related Tables (including raw) ===")
    bank_patterns = ['bank', 'bog', 'raw', 'statement', 'account']
    bank_tables = [t for t in all_tables if any(pattern in t.lower() for pattern in bank_patterns)]
    
    for table in bank_tables:
        try:
            cur.execute(f'SELECT COUNT(*) as count FROM "{table}"')
            count = cur.fetchone()['count']
            print(f"{table}: {count} rows")
        except Exception as e:
            print(f"{table}: ERROR - {str(e)}")
    
    # Check specifically for bog_gel_raw_893486000
    print("\n=== Checking specific raw table ===")
    if 'bog_gel_raw_893486000' in all_tables:
        cur.execute('SELECT COUNT(*) as count FROM bog_gel_raw_893486000')
        count = cur.fetchone()['count']
        print(f"bog_gel_raw_893486000: {count} rows")
        
        # Show sample
        cur.execute('SELECT * FROM bog_gel_raw_893486000 LIMIT 3')
        rows = cur.fetchall()
        if rows:
            print("\nSample rows:")
            for row in rows:
                print(f"  {dict(row)}")
    else:
        print("bog_gel_raw_893486000: NOT FOUND")
    
    cur.close()
    conn.close()
    print("\n✅ Check complete!")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
