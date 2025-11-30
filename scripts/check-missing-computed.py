import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Connect to Supabase
conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

# Check the specific record
print("\n" + "="*120)
print("CHECKING RECORD: 213967bc-2278-41b5-b5cb-23abf5a24f61")
print("="*120)

cur.execute("""
    SELECT 
        counteragent_uuid,
        name,
        identification_number,
        entity_type_uuid,
        country_uuid,
        entity_type,
        country,
        counteragent
    FROM counteragents
    WHERE counteragent_uuid = '213967bc-2278-41b5-b5cb-23abf5a24f61';
""")

row = cur.fetchone()
if row:
    print(f"\nRecord found:")
    print(f"  UUID: {row[0]}")
    print(f"  Name: {row[1]}")
    print(f"  ID Number: {row[2]}")
    print(f"  Entity Type UUID: {row[3]}")
    print(f"  Country UUID: {row[4]}")
    print(f"  Entity Type (computed): {row[5]}")
    print(f"  Country (computed): {row[6]}")
    print(f"  Counteragent (computed): {row[7]}")
    
    # Check if the foreign keys are valid
    if row[3]:
        cur.execute("SELECT name_ka FROM entity_types WHERE entity_type_uuid = %s", (row[3],))
        et = cur.fetchone()
        print(f"\n  Entity Type lookup: {et[0] if et else 'NOT FOUND'}")
    
    if row[4]:
        cur.execute("SELECT name_ka FROM countries WHERE country_uuid = %s", (row[4],))
        co = cur.fetchone()
        print(f"  Country lookup: {co[0] if co else 'NOT FOUND'}")
else:
    print("Record not found!")

# Check how many records have NULL computed fields
print("\n" + "="*120)
print("CHECKING ALL RECORDS WITH MISSING COMPUTED FIELDS")
print("="*120)

cur.execute("""
    SELECT COUNT(*) 
    FROM counteragents 
    WHERE entity_type IS NULL 
       OR country IS NULL 
       OR counteragent IS NULL;
""")

null_count = cur.fetchone()[0]
print(f"\nRecords with NULL computed fields: {null_count}")

# Show sample of records with NULL fields
cur.execute("""
    SELECT 
        counteragent_uuid,
        name,
        entity_type_uuid,
        country_uuid,
        entity_type,
        country
    FROM counteragents
    WHERE entity_type IS NULL 
       OR country IS NULL 
       OR counteragent IS NULL
    LIMIT 10;
""")

print("\nSample records with NULL computed fields:")
print(f"{'UUID':<40} {'Name':<30} {'ET UUID':<40} {'Country UUID':<40}")
print("="*120)
for row in cur.fetchall():
    uuid = str(row[0])[:38]
    name = (row[1] or '')[:30]
    et_uuid = str(row[2] or '')[:38]
    co_uuid = str(row[3] or '')[:38]
    print(f"{uuid:<40} {name:<30} {et_uuid:<40} {co_uuid:<40}")

cur.close()
conn.close()
