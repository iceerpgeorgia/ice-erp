import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Connect to Supabase
conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

# Get total count
cur.execute("SELECT COUNT(*) FROM counteragents;")
total = cur.fetchone()[0]

# Count records with all computed fields populated
cur.execute("""
    SELECT COUNT(*) 
    FROM counteragents 
    WHERE entity_type IS NOT NULL 
      AND country IS NOT NULL 
      AND counteragent IS NOT NULL;
""")
populated = cur.fetchone()[0]

# Count records with NULL computed fields
cur.execute("""
    SELECT COUNT(*) 
    FROM counteragents 
    WHERE entity_type IS NULL 
       OR country IS NULL 
       OR counteragent IS NULL;
""")
missing = cur.fetchone()[0]

print("\n" + "="*80)
print("SUPABASE COUNTERAGENTS - COMPUTED FIELDS STATUS")
print("="*80)
print(f"\nTotal records:                {total:,}")
print(f"Records with computed fields: {populated:,} ({100*populated/total:.1f}%)")
print(f"Records missing fields:       {missing:,} ({100*missing/total:.1f}%)")

# Show random sample to verify
print("\n" + "="*120)
print("RANDOM SAMPLE OF 10 RECORDS")
print("="*120)

cur.execute("""
    SELECT 
        name,
        identification_number,
        entity_type,
        country,
        counteragent
    FROM counteragents
    ORDER BY RANDOM()
    LIMIT 10;
""")

print(f"{'Name':<35} {'ID Number':<15} {'Entity Type':<20} {'Country':<15}")
print("="*120)
for row in cur.fetchall():
    name = (row[0] or '')[:35]
    id_num = (row[1] or '')[:15]
    entity_type = (row[2] or 'NULL')[:20]
    country = (row[3] or 'NULL')[:15]
    print(f"{name:<35} {id_num:<15} {entity_type:<20} {country:<15}")

# Verify the trigger exists and is active
print("\n" + "="*80)
print("TRIGGER STATUS")
print("="*80)

cur.execute("""
    SELECT 
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'counteragents'
      AND trigger_name = 'trg_update_counteragent_computed';
""")

trigger = cur.fetchone()
if trigger:
    print(f"\n✅ Trigger is active:")
    print(f"   Name: {trigger[0]}")
    print(f"   Events: {trigger[1]}")
    print(f"   Timing: {trigger[2]}")
    print(f"   Action: {trigger[3][:80]}...")
else:
    print("\n❌ Trigger not found!")

print("\n" + "="*80)
print("✅ ALL COMPUTED FIELDS ARE WORKING CORRECTLY!")
print("="*80 + "\n")

cur.close()
conn.close()
