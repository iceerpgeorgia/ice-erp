from import_bank_xml_data import get_db_connections
import sys

supabase_conn, local_conn = get_db_connections()

print("=" * 80)
print("SYNCING PARSING RULES FROM LOCAL TO SUPABASE")
print("=" * 80)

# Get parsing rules from LOCAL
local_cur = local_conn.cursor()
local_cur.execute("""
    SELECT id, scheme_uuid, column_name, condition, payment_id, 
           counteragent_uuid, financial_code_uuid, nominal_currency_uuid
    FROM parsing_scheme_rules
    ORDER BY id
""")
local_rules = local_cur.fetchall()
print(f"\n✅ Found {len(local_rules)} parsing rules in LOCAL database")

# Get parsing rules from Supabase
supabase_cur = supabase_conn.cursor()
supabase_cur.execute("""
    SELECT id, scheme_uuid, column_name, condition, payment_id,
           counteragent_uuid, financial_code_uuid, nominal_currency_uuid
    FROM parsing_scheme_rules
    ORDER BY id
""")
supabase_rules = supabase_cur.fetchall()
print(f"✅ Found {len(supabase_rules)} parsing rules in Supabase")

# Compare and show differences
print("\n📊 Comparing rules...")
local_dict = {rule[0]: rule for rule in local_rules}
supabase_dict = {rule[0]: rule for rule in supabase_rules}

differences = []
for rule_id, local_rule in local_dict.items():
    if rule_id in supabase_dict:
        supabase_rule = supabase_dict[rule_id]
        if local_rule != supabase_rule:
            differences.append({
                'id': rule_id,
                'local': local_rule,
                'supabase': supabase_rule
            })
    else:
        differences.append({
            'id': rule_id,
            'local': local_rule,
            'supabase': None
        })

# Check for rules in Supabase but not in LOCAL
for rule_id in supabase_dict:
    if rule_id not in local_dict:
        differences.append({
            'id': rule_id,
            'local': None,
            'supabase': supabase_dict[rule_id]
        })

if len(differences) == 0:
    print("\n✅ All parsing rules are in sync!")
    supabase_conn.close()
    local_conn.close()
    sys.exit(0)

print(f"\n⚠️  Found {len(differences)} differences:")
for diff in differences:
    print(f"\n  Rule ID {diff['id']}:")
    if diff['supabase'] is None:
        print(f"    Status: EXISTS IN LOCAL ONLY")
        print(f"    LOCAL: {diff['local'][2]}={diff['local'][3]} -> payment_id={diff['local'][4]}")
    elif diff['local'] is None:
        print(f"    Status: EXISTS IN SUPABASE ONLY")
        print(f"    SUPABASE: {diff['supabase'][2]}={diff['supabase'][3]} -> payment_id={diff['supabase'][4]}")
    else:
        print(f"    Status: DIFFERENT")
        print(f"    LOCAL: {diff['local'][2]}={diff['local'][3]} -> payment_id={diff['local'][4]}")
        print(f"    SUPABASE: {diff['supabase'][2]}={diff['supabase'][3]} -> payment_id={diff['supabase'][4]}")

print(f"\n⚠️  Ready to sync {len(differences)} parsing rules to Supabase")
print("    This will UPDATE existing rules and INSERT new ones")
response = input("Continue? (yes/no): ")

if response.lower() != 'yes':
    print("❌ Cancelled")
    supabase_conn.close()
    local_conn.close()
    sys.exit(0)

# Sync rules
print("\n🚀 Syncing parsing rules...")
synced = 0
for rule in local_rules:
    try:
        supabase_cur.execute("""
            INSERT INTO parsing_scheme_rules 
            (id, scheme_uuid, column_name, condition, payment_id, 
             counteragent_uuid, financial_code_uuid, nominal_currency_uuid)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                scheme_uuid = EXCLUDED.scheme_uuid,
                column_name = EXCLUDED.column_name,
                condition = EXCLUDED.condition,
                payment_id = EXCLUDED.payment_id,
                counteragent_uuid = EXCLUDED.counteragent_uuid,
                financial_code_uuid = EXCLUDED.financial_code_uuid,
                nominal_currency_uuid = EXCLUDED.nominal_currency_uuid
        """, rule)
        synced += 1
    except Exception as e:
        print(f"  ⚠️ Error syncing rule {rule[0]}: {e}")

supabase_conn.commit()
print(f"\n✅ Successfully synced {synced} parsing rules to Supabase")

# Verify
supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules")
final_count = supabase_cur.fetchone()[0]
print(f"✅ Supabase now has {final_count} parsing rules")

supabase_conn.close()
local_conn.close()
