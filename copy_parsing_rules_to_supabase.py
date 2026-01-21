import psycopg2

print("🔄 Copying parsing rules from Local DB to Supabase...")

# Connect to both databases
local_conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
remote_conn = psycopg2.connect('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')

local_cur = local_conn.cursor()
remote_cur = remote_conn.cursor()

# Get all parsing rules from local
local_cur.execute("""
    SELECT id, rule_name, rule_description, parameters, condition_script, is_active, created_at, updated_at
    FROM parsing_scheme_rules
    ORDER BY id
""")
rules = local_cur.fetchall()

print(f"📦 Found {len(rules)} parsing rules in Local DB")

# Clear existing rules on Supabase (if any)
remote_cur.execute("DELETE FROM parsing_scheme_rules")
print(f"🗑️  Cleared existing rules on Supabase")

# Insert rules into Supabase
inserted = 0
for rule in rules:
    try:
        remote_cur.execute("""
            INSERT INTO parsing_scheme_rules (id, rule_name, rule_description, parameters, condition_script, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, rule)
        inserted += 1
    except Exception as e:
        print(f"❌ Error inserting rule {rule[0]}: {e}")

remote_conn.commit()

# Verify
remote_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE is_active = TRUE")
active_count = remote_cur.fetchone()[0]

print(f"\n✅ Successfully copied {inserted} parsing rules to Supabase")
print(f"📊 Active rules: {active_count}")

# Show sample rules
remote_cur.execute("""
    SELECT id, rule_name, is_active 
    FROM parsing_scheme_rules 
    ORDER BY id 
    LIMIT 5
""")
print("\n📋 Sample rules:")
for r in remote_cur.fetchall():
    status = "✅" if r[2] else "⚠️"
    print(f"  {status} ID: {r[0]:3d} | {r[1]}")

local_conn.close()
remote_conn.close()

print("\n✅ Done! Now you need to re-run backparse to apply these rules.")
