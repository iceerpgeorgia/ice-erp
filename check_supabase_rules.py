import psycopg2

supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(supabase_conn_str)
cur = conn.cursor()

# Check row count
cur.execute('SELECT COUNT(*) FROM parsing_scheme_rules')
total = cur.fetchone()[0]

# Check for active column
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'parsing_scheme_rules' AND column_name = 'active'
""")
has_active = cur.fetchone()

print(f"Supabase parsing_scheme_rules:")
print(f"  Total rows: {total}")
print(f"  Has 'active' column: {'Yes' if has_active else 'No'}")

if has_active and total > 0:
    # Check active vs inactive
    cur.execute('SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE')
    active_count = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = FALSE')
    inactive_count = cur.fetchone()[0]
    print(f"  Active rules: {active_count}")
    print(f"  Inactive rules: {inactive_count}")

conn.close()
