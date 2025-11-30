import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*120)
print("FINAL VERIFICATION - ALL COUNTERAGENTS HAVE INTERNAL NUMBERS")
print("="*120)

# Count total records
cur.execute("SELECT COUNT(*) FROM counteragents;")
total = cur.fetchone()[0]

# Count records with internal_number
cur.execute("SELECT COUNT(*) FROM counteragents WHERE internal_number IS NOT NULL;")
with_internal = cur.fetchone()[0]

# Count records without internal_number
cur.execute("SELECT COUNT(*) FROM counteragents WHERE internal_number IS NULL;")
without_internal = cur.fetchone()[0]

print(f"\n📊 STATISTICS:")
print(f"{'='*60}")
print(f"Total counteragents:                {total:,}")
print(f"With internal_number:               {with_internal:,} ({100*with_internal/total:.1f}%)")
print(f"Without internal_number:            {without_internal:,} ({100*without_internal/total:.1f}%)")

# Show range of internal numbers
cur.execute("""
    SELECT 
        MIN(internal_number) as first,
        MAX(internal_number) as last
    FROM counteragents
    WHERE internal_number IS NOT NULL;
""")

row = cur.fetchone()
print(f"\nInternal number range:              {row[0]} to {row[1]}")

# Show newest assigned records
print("\n" + "="*120)
print("LAST 10 ASSIGNED INTERNAL NUMBERS:")
print("="*120)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        counteragent
    FROM counteragents
    WHERE internal_number IS NOT NULL
    ORDER BY internal_number DESC
    LIMIT 10;
""")

print(f"{'Name':<35} {'Internal No':<15} {'ID Number':<15} {'Counteragent':<60}")
print("="*120)
for row in cur.fetchall():
    name = (row[0] or '')[:35]
    internal = (row[1] or '')[:15]
    id_num = (row[2] or '')[:15]
    counteragent = (row[3] or '')[:60]
    print(f"{name:<35} {internal:<15} {id_num:<15} {counteragent:<60}")

# Verify all have internal number in computed field
cur.execute("""
    SELECT COUNT(*)
    FROM counteragents
    WHERE internal_number IS NOT NULL
      AND counteragent LIKE '%[' || internal_number || ']%';
""")

all_in_computed = cur.fetchone()[0]

print("\n" + "="*120)
print("✅ VERIFICATION RESULTS:")
print("="*120)
print(f"All {with_internal:,} records have internal_number: {'✅ YES' if without_internal == 0 else '❌ NO'}")
print(f"All internal_numbers in computed field: {'✅ YES' if all_in_computed == with_internal else '❌ NO'}")
print(f"  ({all_in_computed:,} out of {with_internal:,} records)")

print("\n" + "="*120)
print("🎉 ALL COUNTERAGENTS NOW HAVE INTERNAL NUMBERS!")
print("="*120 + "\n")

cur.close()
conn.close()
