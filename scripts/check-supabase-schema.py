import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("SUPABASE COUNTERAGENTS TABLE STRUCTURE")
print("="*80)

conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres')
cur = conn.cursor()

# Check columns
cur.execute("""
    SELECT column_name, data_type, column_default, is_generated
    FROM information_schema.columns 
    WHERE table_name = 'counteragents' 
    ORDER BY ordinal_position
""")

print("\n📋 COLUMNS:")
for row in cur.fetchall():
    col_name = row[0]
    data_type = row[1]
    default = row[2] if row[2] else 'None'
    generated = row[3]
    print(f"  {col_name:<30} {data_type:<20} Default: {default:<40} Generated: {generated}")

# Check for computed columns in local
print("\n" + "="*80)
print("LOCAL DATABASE - COUNTERAGENTS TABLE STRUCTURE")
print("="*80)

local_conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
local_cur = local_conn.cursor()

local_cur.execute("""
    SELECT column_name, data_type, column_default, is_generated
    FROM information_schema.columns 
    WHERE table_name = 'counteragents' 
    ORDER BY ordinal_position
""")

print("\n📋 COLUMNS:")
for row in local_cur.fetchall():
    col_name = row[0]
    data_type = row[1]
    default = row[2] if row[2] else 'None'
    generated = row[3]
    print(f"  {col_name:<30} {data_type:<20} Default: {default:<40} Generated: {generated}")

# Compare
print("\n" + "="*80)
print("MISSING IN SUPABASE:")
print("="*80)

local_cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'counteragents'")
local_cols = {row[0] for row in local_cur.fetchall()}

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'counteragents'")
remote_cols = {row[0] for row in cur.fetchall()}

missing = local_cols - remote_cols
if missing:
    print(f"\n⚠️  {len(missing)} columns missing in Supabase:")
    for col in missing:
        print(f"    - {col}")
else:
    print("\n✓ All columns present in Supabase")

extra = remote_cols - local_cols
if extra:
    print(f"\n⚠️  {len(extra)} extra columns in Supabase:")
    for col in extra:
        print(f"    - {col}")

conn.close()
local_conn.close()
