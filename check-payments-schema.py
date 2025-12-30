import psycopg2

conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')
cur = conn.cursor()

print("=== TRIGGERS ON PAYMENTS TABLE ===")
cur.execute("""
    SELECT tgname, tgtype, proname 
    FROM pg_trigger t 
    JOIN pg_proc p ON t.tgfoid = p.oid 
    WHERE tgrelid = 'payments'::regclass
""")
triggers = cur.fetchall()
for t in triggers:
    print(f"  {t}")

print("\n=== CONSTRAINTS ON PAYMENTS TABLE ===")
cur.execute("""
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'payments'::regclass
""")
constraints = cur.fetchall()
for c in constraints:
    print(f"  {c}")

conn.close()
