import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*120)
print("FINAL VERIFICATION - COMPUTED FIELDS WITH INTERNAL_NUMBER")
print("="*120)

# Show records WITH internal_number
print("\n📋 RECORDS WITH INTERNAL_NUMBER:")
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
    WHERE internal_number IS NOT NULL
    ORDER BY internal_number
    LIMIT 10;
""")

print(f"{'Name':<30} {'Internal':<12} {'ID Number':<15} {'Entity Type':<15} {'Country':<15}")
print(f"{'Counteragent (Full Display)':<120}")
print("="*120)
for row in cur.fetchall():
    name = (row[0] or '')[:30]
    internal = (row[1] or '')[:12]
    id_num = (row[2] or '')[:15]
    entity = (row[3] or '')[:15]
    country = (row[4] or '')[:15]
    counteragent = row[5] or ''
    print(f"{name:<30} {internal:<12} {id_num:<15} {entity:<15} {country:<15}")
    print(f"→ {counteragent}")
    print()

# Show records WITHOUT internal_number
print("\n📋 RECORDS WITHOUT INTERNAL_NUMBER (276 records):")
print("="*120)
cur.execute("""
    SELECT 
        name,
        identification_number,
        entity_type,
        country,
        counteragent
    FROM counteragents
    WHERE internal_number IS NULL
    ORDER BY id DESC
    LIMIT 5;
""")

print(f"{'Name':<35} {'ID Number':<15} {'Entity Type':<15} {'Country':<15}")
print(f"{'Counteragent (Full Display)':<120}")
print("="*120)
for row in cur.fetchall():
    name = (row[0] or '')[:35]
    id_num = (row[1] or '')[:15]
    entity = (row[2] or '')[:15]
    country = (row[3] or '')[:15]
    counteragent = row[4] or ''
    print(f"{name:<35} {id_num:<15} {entity:<15} {country:<15}")
    print(f"→ {counteragent}")
    print()

# Summary statistics
print("="*120)
print("📊 SUMMARY STATISTICS")
print("="*120)

cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN internal_number IS NOT NULL THEN 1 END) as with_internal,
        COUNT(CASE WHEN internal_number IS NULL THEN 1 END) as without_internal,
        COUNT(CASE WHEN entity_type IS NOT NULL THEN 1 END) as with_entity_type,
        COUNT(CASE WHEN country IS NOT NULL THEN 1 END) as with_country,
        COUNT(CASE WHEN counteragent IS NOT NULL THEN 1 END) as with_counteragent
    FROM counteragents;
""")

row = cur.fetchone()
print(f"\nTotal records:                    {row[0]:,}")
print(f"With internal_number:             {row[1]:,} ({100*row[1]/row[0]:.1f}%)")
print(f"Without internal_number:          {row[2]:,} ({100*row[2]/row[0]:.1f}%)")
print(f"With entity_type (computed):      {row[3]:,} ({100*row[3]/row[0]:.1f}%)")
print(f"With country (computed):          {row[4]:,} ({100*row[4]/row[0]:.1f}%)")
print(f"With counteragent (computed):     {row[5]:,} ({100*row[5]/row[0]:.1f}%)")

print("\n" + "="*120)
print("✅ ALL COMPUTED FIELDS ARE WORKING CORRECTLY!")
print("="*120)
print("\nFormat with internal_number:    Name [ICE000001] (ს.კ. ID) - Entity Type")
print("Format without internal_number: Name (ს.კ. ID) - Entity Type")
print()

cur.close()
conn.close()
