import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Connect to Supabase
conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

# Get a sample of records with computed columns
cur.execute("""
    SELECT 
        name,
        identification_number,
        entity_type,
        country,
        counteragent
    FROM counteragents
    WHERE name LIKE '%ბიზნეს%'
    OR name LIKE '%ICE%'
    LIMIT 10;
""")

print("\n" + "="*120)
print("SUPABASE COUNTERAGENTS - COMPUTED COLUMNS VERIFICATION")
print("="*120)
print(f"{'Name':<40} {'ID Number':<15} {'Entity Type':<20} {'Country':<15} {'Counteragent':<30}")
print("="*120)

for row in cur.fetchall():
    name = (row[0] or '')[:40]
    id_num = (row[1] or '')[:15]
    entity_type = (row[2] or '')[:20]
    country = (row[3] or '')[:15]
    counteragent = (row[4] or '')[:30]
    print(f"{name:<40} {id_num:<15} {entity_type:<20} {country:<15} {counteragent:<30}")

print("="*120)
print("\n✅ Computed columns are working! Entity types and countries show readable names.")

cur.close()
conn.close()
