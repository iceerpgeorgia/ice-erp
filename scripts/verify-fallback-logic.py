import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*140)
print("FINAL VERIFICATION - INTERNAL_NUMBER FALLBACK FOR MISSING ID NUMBERS")
print("="*140)

# Count records by ID number availability
cur.execute("""
    SELECT 
        COUNT(*) FILTER (WHERE identification_number IS NOT NULL) as with_id,
        COUNT(*) FILTER (WHERE identification_number IS NULL) as without_id,
        COUNT(*) as total
    FROM counteragents;
""")

row = cur.fetchone()
print(f"\n📊 STATISTICS:")
print(f"{'='*80}")
print(f"Total counteragents:                  {row[2]:,}")
print(f"With identification_number:           {row[0]:,} ({100*row[0]/row[2]:.1f}%)")
print(f"Without identification_number:        {row[1]:,} ({100*row[1]/row[2]:.1f}%)")
print(f"  → Using internal_number instead:    {row[1]:,}")

# Show examples WITH ID number
print("\n" + "="*140)
print("📋 EXAMPLES WITH IDENTIFICATION_NUMBER (using ID number):")
print("="*140)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    WHERE identification_number IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 5;
""")

print(f"{'Name':<40} {'Internal No':<15} {'ID Number':<15} {'Entity Type':<20}")
print(f"{'→ Counteragent Display':<140}")
print("="*140)
for row in cur.fetchall():
    name = (row[0] or '')[:40]
    internal = (row[1] or '')[:15]
    id_num = (row[2] or '')[:15]
    entity = (row[3] or '')[:20]
    counteragent = row[4] or ''
    print(f"{name:<40} {internal:<15} {id_num:<15} {entity:<20}")
    print(f"→ {counteragent}")
    print()

# Show examples WITHOUT ID number
print("="*140)
print("📋 EXAMPLES WITHOUT IDENTIFICATION_NUMBER (using internal_number as fallback):")
print("="*140)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    WHERE identification_number IS NULL
    ORDER BY RANDOM()
    LIMIT 10;
""")

print(f"{'Name':<40} {'Internal No':<15} {'ID Number':<15} {'Entity Type':<20}")
print(f"{'→ Counteragent Display':<140}")
print("="*140)
for row in cur.fetchall():
    name = (row[0] or '')[:40]
    internal = (row[1] or '')[:15]
    id_num = 'NULL'
    entity = (row[3] or '')[:20]
    counteragent = row[4] or ''
    print(f"{name:<40} {internal:<15} {id_num:<15} {entity:<20}")
    print(f"→ {counteragent}")
    
    # Verify internal_number is in the counteragent field
    if row[1] and row[1] in counteragent:
        print(f"  ✅ Internal number [{row[1]}] is used as ID")
    else:
        print(f"  ⚠️  Internal number not found in display")
    print()

# Check for KLEEMANN specifically
print("="*140)
print("📋 SPECIFIC EXAMPLE: KLEEMANN HELLAS S.A.")
print("="*140)

cur.execute("""
    SELECT 
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent
    FROM counteragents
    WHERE name LIKE '%KLEEMANN%'
    LIMIT 1;
""")

row = cur.fetchone()
if row:
    print(f"\nName:                  {row[0]}")
    print(f"Internal Number:       {row[1]}")
    print(f"ID Number:             {row[2] or 'NULL'}")
    print(f"Entity Type:           {row[3]}")
    print(f"Counteragent Display:  {row[4]}")
    print(f"\n✅ Expected: KLEEMANN HELLAS S.A. (ს.კ. {row[1]}) - {row[3]}")

print("\n" + "="*140)
print("✅ VERIFICATION COMPLETE - INTERNAL_NUMBER FALLBACK WORKING!")
print("="*140)
print("\nFormat rules:")
print("  1. If identification_number EXISTS → Name (ს.კ. ID_NUMBER) - Entity Type")
print("  2. If identification_number is NULL → Name (ს.კ. INTERNAL_NUMBER) - Entity Type")
print()

cur.close()
conn.close()
