import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Connect to Supabase
conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*120)
print("CHECKING INTERNAL_NUMBER FIELD IN COUNTERAGENTS")
print("="*120)

# Check if internal_number has values
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(internal_number) as with_internal_no,
        COUNT(*) - COUNT(internal_number) as without_internal_no
    FROM counteragents;
""")

row = cur.fetchone()
total = row[0]
with_no = row[1]
without_no = row[2]

print(f"\nTotal records:              {total:,}")
print(f"With internal_number:       {with_no:,} ({100*with_no/total:.1f}%)")
print(f"Without internal_number:    {without_no:,} ({100*without_no/total:.1f}%)")

# Show sample records with internal_number
print("\n" + "="*120)
print("SAMPLE RECORDS WITH INTERNAL_NUMBER")
print("="*120)

cur.execute("""
    SELECT 
        counteragent_uuid,
        name,
        internal_number,
        identification_number,
        counteragent
    FROM counteragents
    WHERE internal_number IS NOT NULL
    ORDER BY internal_number
    LIMIT 20;
""")

print(f"{'UUID':<40} {'Name':<30} {'Internal No':<15} {'ID Number':<15} {'Counteragent (computed)':<50}")
print("="*120)
for row in cur.fetchall():
    uuid = str(row[0])[:38]
    name = (row[1] or '')[:30]
    internal = (row[2] or '')[:15]
    id_num = (row[3] or '')[:15]
    counteragent = (row[4] or '')[:50]
    print(f"{uuid:<40} {name:<30} {internal:<15} {id_num:<15} {counteragent:<50}")

# Check the specific record mentioned
print("\n" + "="*120)
print("SPECIFIC RECORD: 213967bc-2278-41b5-b5cb-23abf5a24f61")
print("="*120)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        country,
        counteragent
    FROM counteragents
    WHERE counteragent_uuid = '213967bc-2278-41b5-b5cb-23abf5a24f61';
""")

row = cur.fetchone()
if row:
    print(f"\nName:               {row[0]}")
    print(f"Internal Number:    {row[1] or 'NULL'}")
    print(f"ID Number:          {row[2] or 'NULL'}")
    print(f"Entity Type:        {row[3] or 'NULL'}")
    print(f"Country:            {row[4] or 'NULL'}")
    print(f"Counteragent:       {row[5] or 'NULL'}")

# Check what format internal_number should be
print("\n" + "="*120)
print("INTERNAL_NUMBER PATTERNS")
print("="*120)

cur.execute("""
    SELECT 
        internal_number,
        COUNT(*) as count
    FROM counteragents
    WHERE internal_number IS NOT NULL
    GROUP BY internal_number
    ORDER BY count DESC, internal_number
    LIMIT 20;
""")

print(f"{'Internal Number':<30} {'Count':<10}")
print("="*60)
for row in cur.fetchall():
    print(f"{row[0]:<30} {row[1]:<10}")

print("\n" + "="*120)
print("RECOMMENDATION:")
print("Should the 'counteragent' computed field include internal_number?")
print("Current format: Name (ს.კ. ID) - Entity Type")
print("Proposed format: Name [Internal: XXX] (ს.კ. ID) - Entity Type")
print("="*120 + "\n")

cur.close()
conn.close()
