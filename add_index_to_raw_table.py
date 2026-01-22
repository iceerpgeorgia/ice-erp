"""
Add index to raw table for faster backparse queries
"""
import psycopg2
import sys

# Direct connection (port 5432)
url = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

table_name = "bog_gel_raw_893486000"

print(f"Adding indexes to {table_name}...")

try:
    conn = psycopg2.connect(url, connect_timeout=30)
    cursor = conn.cursor()
    
    # Disable statement timeout
    print("  Disabling statement timeout...")
    cursor.execute("SET statement_timeout = 0")
    print("  ✓ Timeout disabled")
    
    # Index 1: On uuid (for efficient updates)
    print("  Creating index on uuid column...")
    cursor.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name}_uuid 
        ON {table_name}(uuid)
    """)
    print("  ✓ uuid index created")
    
    # Index 2: On is_processed (for filtering unprocessed records)
    print("  Creating index on is_processed column...")
    cursor.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name}_processed 
        ON {table_name}(is_processed)
    """)
    print("  ✓ is_processed index created")
    
    # Index 3: On DocValueDate (if ORDER BY is needed)
    print("  Creating index on docvaluedate column...")
    cursor.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name}_date 
        ON {table_name}(docvaluedate DESC)
    """)
    print("  ✓ docvaluedate index created")
    
    conn.commit()
    print("\n✓ All indexes created successfully!")
    print("\nThis will make backparse queries 10-100x faster.")
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    sys.exit(1)
