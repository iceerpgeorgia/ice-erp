import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Get UUID from command line if provided
uuid_to_check = sys.argv[1] if len(sys.argv) > 1 else None

conn = psycopg2.connect(REMOTE_DATABASE_URL)
cur = conn.cursor()

if uuid_to_check:
    print("\n" + "="*120)
    print(f"CHECKING SPECIFIC RECORD: {uuid_to_check}")
    print("="*120)
    
    cur.execute("""
        SELECT 
            counteragent_uuid,
            name,
            internal_number,
            identification_number,
            entity_type_uuid,
            country_uuid,
            entity_type,
            country,
            counteragent,
            created_at,
            updated_at
        FROM counteragents
        WHERE counteragent_uuid = %s;
    """, (uuid_to_check,))
    
    row = cur.fetchone()
    if row:
        print(f"\n✅ Record found:\n")
        print(f"  UUID:                {row[0]}")
        print(f"  Name:                {row[1]}")
        print(f"  Internal Number:     {row[2] or 'NULL'}")
        print(f"  ID Number:           {row[3] or 'NULL'}")
        print(f"  Entity Type UUID:    {row[4]}")
        print(f"  Country UUID:        {row[5]}")
        print(f"  Entity Type:         {row[6] or 'NULL'}")
        print(f"  Country:             {row[7] or 'NULL'}")
        print(f"  Counteragent:        {row[8] or 'NULL'}")
        print(f"  Created:             {row[9]}")
        print(f"  Updated:             {row[10]}")
        
        # Check if internal number is in computed field
        if row[2]:  # has internal_number
            if row[2] in (row[8] or ''):
                print(f"\n  ✅ Internal number [{row[2]}] IS in computed field")
            else:
                print(f"\n  ❌ Internal number [{row[2]}] is MISSING from computed field")
                print(f"     Expected format: {row[1]} [{row[2]}] (ს.კ. {row[3]}) - {row[6]}")
        else:
            print(f"\n  ℹ️  No internal_number set for this record")
    else:
        print(f"\n❌ Record not found with UUID: {uuid_to_check}")
else:
    # Show first 10 records with internal number
    print("\n" + "="*120)
    print("FIRST 10 RECORDS (sorted by internal_number)")
    print("="*120)
    print("\nUsage: python scripts/check-specific-record.py <uuid>")
    print("       To check a specific record by UUID\n")
    
    cur.execute("""
        SELECT 
            counteragent_uuid,
            internal_number,
            name,
            counteragent
        FROM counteragents
        WHERE internal_number IS NOT NULL
        ORDER BY internal_number
        LIMIT 10;
    """)
    
    print(f"{'UUID':<40} {'Internal':<12} {'Name':<30}")
    print(f"{'→ Computed Counteragent':<120}")
    print("="*120)
    
    for row in cur.fetchall():
        print(f"{str(row[0]):<40} {row[1]:<12} {row[2][:30]:<30}")
        print(f"→ {row[3]}")
        if row[1] in row[3]:
            print("  ✅ Internal number IS included")
        else:
            print("  ❌ Internal number MISSING")
        print()

print("\n" + "="*120 + "\n")

cur.close()
conn.close()
