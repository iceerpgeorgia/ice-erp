import psycopg2
from urllib.parse import urlparse

# Read database URL
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        if 'REMOTE_DATABASE_URL' in line:
            url = line.split('=', 1)[1].strip().strip('"').strip("'")
            break

parsed = urlparse(url)
conn = psycopg2.connect(f"{parsed.scheme}://{parsed.netloc}{parsed.path}")
cur = conn.cursor()

# Check column names in raw table
cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000' 
    AND (column_name ILIKE '%doc%information%' OR column_name ILIKE '%information%')
    ORDER BY column_name
""")
cols = cur.fetchall()

print("\nColumns with 'information' in name:")
for c in cols:
    print(f"  - {c[0]}")

# Also check all column names starting with 'doc'
cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000' 
    AND column_name ILIKE 'doc%'
    ORDER BY column_name
""")
doc_cols = cur.fetchall()

print("\nAll columns starting with 'doc':")
for c in doc_cols:
    print(f"  - {c[0]}")

cur.close()
conn.close()
