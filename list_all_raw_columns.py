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

# Get all columns from the raw table
cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()

print("\n" + "="*70)
print("ALL COLUMNS IN bog_gel_raw_893486000 TABLE")
print("="*70)
for i, (col,) in enumerate(cols, 1):
    print(f"{i:3}. {col}")

print("\n" + "="*70)

cur.close()
conn.close()
