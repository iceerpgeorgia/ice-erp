import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Connect to Supabase
supabase_url = os.getenv('DIRECT_URL')
conn = psycopg2.connect(supabase_url)
cur = conn.cursor()

# Get column names
cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000'
    ORDER BY ordinal_position
""")

print("\n📋 Columns in bog_gel_raw_893486000:")
for row in cur.fetchall():
    col = row[0]
    if 'info' in col.lower() or 'doc' in col.lower():
        print(f"  ✓ {col}")
    else:
        print(f"    {col}")

# Check for salary payments in doc field
cur.execute("""
    SELECT docinformation 
    FROM bog_gel_raw_893486000
    WHERE docinformation ILIKE '%NP_%'
    LIMIT 5
""")

print("\n📋 Sample records with 'NP_' pattern:")
for row in cur.fetchall():
    info = row[0]
    if info:
        print(f"  {info[:150]}")

conn.close()
