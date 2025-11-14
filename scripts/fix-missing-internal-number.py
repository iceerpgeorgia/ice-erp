import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

print("\n" + "="*120)
print("CHECKING RECORDS WITH INTERNAL_NUMBER BUT MISSING IN COMPUTED FIELD")
print("="*120)

# Find records where internal_number exists but counteragent field doesn't contain it
cur.execute("""
    SELECT 
        counteragent_uuid,
        name,
        internal_number,
        identification_number,
        entity_type,
        counteragent,
        POSITION('[' || internal_number || ']' IN counteragent) as has_internal_in_computed
    FROM counteragents
    WHERE internal_number IS NOT NULL
      AND counteragent NOT LIKE '%[' || internal_number || ']%'
    ORDER BY internal_number
    LIMIT 20;
""")

rows = cur.fetchall()
count_missing = len(rows)

if count_missing > 0:
    print(f"\n⚠️ Found {count_missing} records where internal_number exists but NOT in computed field:\n")
    print(f"{'UUID':<40} {'Name':<30} {'Internal No':<15}")
    print(f"{'Current Counteragent Field':<120}")
    print("="*120)
    
    for row in rows:
        uuid = str(row[0])[:38]
        name = (row[1] or '')[:30]
        internal = (row[2] or '')[:15]
        counteragent = row[5] or ''
        
        print(f"{uuid:<40} {name:<30} {internal:<15}")
        print(f"→ {counteragent}")
        print()
else:
    print("\n✅ All records with internal_number have it in the computed field!")

# Get total count
cur.execute("""
    SELECT COUNT(*)
    FROM counteragents
    WHERE internal_number IS NOT NULL
      AND counteragent NOT LIKE '%[' || internal_number || ']%';
""")

total_missing = cur.fetchone()[0]
print("="*120)
print(f"Total records missing internal_number in computed field: {total_missing:,}")

# Check the trigger status
print("\n" + "="*120)
print("CHECKING TRIGGER STATUS")
print("="*120)

cur.execute("""
    SELECT 
        trigger_name,
        event_manipulation,
        action_timing,
        event_object_table
    FROM information_schema.triggers
    WHERE event_object_table = 'counteragents'
    ORDER BY trigger_name;
""")

triggers = cur.fetchall()
if triggers:
    print("\nActive triggers on counteragents table:")
    for t in triggers:
        print(f"  - {t[0]}: {t[2]} {t[1]} on {t[3]}")
else:
    print("\n❌ No triggers found on counteragents table!")

# If there are missing records, let's fix them
if total_missing > 0:
    print("\n" + "="*120)
    print("FIXING RECORDS...")
    print("="*120)
    
    print(f"\nUpdating {total_missing:,} records with internal_number in computed field...")
    
    cur.execute("""
        UPDATE counteragents
        SET counteragent = name || 
            COALESCE(' [' || internal_number || ']', '') ||
            COALESCE(' (ს.კ. ' || identification_number || ')', '') ||
            COALESCE(' - ' || entity_type, '')
        WHERE internal_number IS NOT NULL
          AND counteragent NOT LIKE '%[' || internal_number || ']%';
    """)
    
    updated = cur.rowcount
    conn.commit()
    print(f"✅ Updated {updated:,} records")
    
    # Verify the fix
    print("\nVerifying updates...")
    cur.execute("""
        SELECT 
            name,
            internal_number,
            counteragent
        FROM counteragents
        WHERE internal_number IS NOT NULL
        ORDER BY internal_number
        LIMIT 5;
    """)
    
    print(f"\n{'Name':<30} {'Internal No':<15} {'Counteragent':<70}")
    print("="*120)
    for row in cur.fetchall():
        print(f"{row[0][:30]:<30} {row[1]:<15} {row[2][:70]:<70}")

print("\n" + "="*120)
print("✅ VERIFICATION COMPLETE")
print("="*120 + "\n")

cur.close()
conn.close()
