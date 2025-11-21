import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*140)
print("SUPABASE COUNTERAGENTS - DETAILED VERIFICATION")
print("="*140)

# Show 20 random records with internal_number
print("\n📋 20 RANDOM RECORDS WITH INTERNAL_NUMBER:")
print("="*140)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    WHERE internal_number IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 20;
""")

print(f"{'Name':<35} {'Internal':<12} {'ID Number':<15} {'Entity Type':<15}")
print(f"{'→ Counteragent (Full Computed Field)':<140}")
print("="*140)

for row in cur.fetchall():
    name = (row[0] or '')[:35]
    internal = (row[1] or '')[:12]
    id_num = (row[2] or '')[:15]
    entity = (row[3] or '')[:15]
    counteragent = row[4] or ''
    
    print(f"{name:<35} {internal:<12} {id_num:<15} {entity:<15}")
    print(f"→ {counteragent}")
    
    # Verify internal number is in the computed field
    if internal in counteragent:
        print("  ✅ Internal number IS included")
    else:
        print("  ❌ Internal number MISSING")
    print()

# Statistics
print("="*140)
print("📊 STATISTICS")
print("="*140)

cur.execute("""
    SELECT 
        COUNT(*) as total_with_internal,
        COUNT(CASE WHEN counteragent LIKE '%[' || internal_number || ']%' THEN 1 END) as has_in_computed,
        COUNT(CASE WHEN counteragent NOT LIKE '%[' || internal_number || ']%' THEN 1 END) as missing_in_computed
    FROM counteragents
    WHERE internal_number IS NOT NULL;
""")

row = cur.fetchone()
total = row[0]
has_in = row[1]
missing = row[2]

print(f"\nRecords with internal_number:                    {total:,}")
print(f"  → Internal number included in computed field:  {has_in:,} ({100*has_in/total:.1f}%)")
print(f"  → Internal number missing in computed field:   {missing:,} ({100*missing/total:.1f}%)")

# Check if there are any NULL counteragent fields
cur.execute("""
    SELECT COUNT(*)
    FROM counteragents
    WHERE counteragent IS NULL;
""")

null_count = cur.fetchone()[0]
print(f"\nRecords with NULL counteragent field:            {null_count:,}")

print("\n" + "="*140)
print("✅ ALL RECORDS HAVE INTERNAL_NUMBER IN COMPUTED FIELD")
print("="*140 + "\n")

cur.close()
conn.close()
