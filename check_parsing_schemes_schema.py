import psycopg2

# Connection strings
local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("="*60)
print("CHECKING PARSING_SCHEMES SCHEMA")
print("="*60)

# Check local
print("\n📊 LOCAL DB:")
local_conn = psycopg2.connect(local_conn_str)
local_cur = local_conn.cursor()
local_cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'parsing_schemes' 
    ORDER BY ordinal_position
""")
local_cols = local_cur.fetchall()
for col, dtype in local_cols:
    print(f"   {col}: {dtype}")

local_cur.execute("SELECT * FROM parsing_schemes LIMIT 1")
sample = local_cur.fetchone()
if sample:
    print(f"\n   Sample row: {sample}")

local_cur.execute("SELECT COUNT(*) FROM parsing_schemes")
print(f"   Total rows: {local_cur.fetchone()[0]}")
local_conn.close()

# Check Supabase
print("\n📊 SUPABASE:")
supabase_conn = psycopg2.connect(supabase_conn_str)
supabase_cur = supabase_conn.cursor()
supabase_cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'parsing_schemes' 
    ORDER BY ordinal_position
""")
supabase_cols = supabase_cur.fetchall()
for col, dtype in supabase_cols:
    print(f"   {col}: {dtype}")

supabase_cur.execute("SELECT COUNT(*) FROM parsing_schemes")
print(f"   Total rows: {supabase_cur.fetchone()[0]}")
supabase_conn.close()

print("\n" + "="*60)
