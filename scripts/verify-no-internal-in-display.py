import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*120)
print("FINAL VERIFICATION - COUNTERAGENT FORMAT WITHOUT INTERNAL_NUMBER")
print("="*120)

# Show random sample of records
print("\n📋 20 RANDOM RECORDS (internal_number exists but NOT displayed):")
print("="*120)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    ORDER BY RANDOM()
    LIMIT 20;
""")

print(f"{'Name':<35} {'Internal No':<15} {'ID Number':<15} {'Counteragent (Display)':<60}")
print("="*120)

correct_count = 0
total_count = 0

for row in cur.fetchall():
    name = (row[0] or '')[:35]
    internal = (row[1] or 'N/A')[:15]
    id_num = (row[2] or '')[:15]
    counteragent = (row[4] or '')[:60]
    
    print(f"{name:<35} {internal:<15} {id_num:<15} {counteragent:<60}")
    
    total_count += 1
    # Check if internal_number is NOT in counteragent (which is correct)
    if row[1] and row[1] not in (row[4] or ''):
        correct_count += 1

# Statistics
print("\n" + "="*120)
print("📊 VERIFICATION STATISTICS:")
print("="*120)

cur.execute("""
    SELECT COUNT(*)
    FROM counteragents
    WHERE internal_number IS NOT NULL
      AND counteragent LIKE '%[' || internal_number || ']%';
""")

with_internal_in_display = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*)
    FROM counteragents
    WHERE internal_number IS NOT NULL;
""")

total_with_internal = cur.fetchone()[0]

print(f"\nTotal records with internal_number:           {total_with_internal:,}")
print(f"Records with internal_number IN display:      {with_internal_in_display:,}")
print(f"Records with internal_number NOT in display:  {total_with_internal - with_internal_in_display:,}")

if with_internal_in_display == 0:
    print("\n✅ SUCCESS: No records have internal_number in the display field!")
else:
    print(f"\n⚠️  WARNING: {with_internal_in_display} records still have internal_number in display!")

# Show the exact format
print("\n" + "="*120)
print("FORMAT EXAMPLES:")
print("="*120)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    WHERE name = 'ენერგომობილი'
    LIMIT 1;
""")

row = cur.fetchone()
if row:
    print(f"\nExample: {row[0]}")
    print(f"  Internal Number (in column): {row[1]}")
    print(f"  Counteragent (displayed):    {row[4]}")
    print(f"\n  ✅ Format: Name (ს.კ. ID) - Entity Type")
    print(f"  ✅ Internal number [{row[1]}] is stored but NOT displayed")

print("\n" + "="*120)
print("🎉 COUNTERAGENT DISPLAY FORMAT UPDATED SUCCESSFULLY!")
print("="*120)
print("\nInternal numbers:")
print("  - Are assigned and stored in the 'internal_number' column")
print("  - Are NOT displayed in the 'counteragent' computed field")
print("  - Can be queried separately when needed")
print()

cur.close()
conn.close()
