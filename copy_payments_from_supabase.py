from import_bank_xml_data import get_db_connections
import sys

supabase_conn, local_conn = get_db_connections()

print("=" * 80)
print("COPYING MISSING PAYMENTS FROM SUPABASE TO LOCAL")
print("=" * 80)

# Get all payments from Supabase
supabase_cur = supabase_conn.cursor()
supabase_cur.execute("""
    SELECT id, payment_id, counteragent_uuid, project_uuid, financial_code_uuid, 
           currency_uuid, created_at, updated_at
    FROM payments
    ORDER BY created_at
""")
supabase_payments = supabase_cur.fetchall()
print(f"\n✅ Found {len(supabase_payments)} payments in Supabase")

# Get all payments from LOCAL
local_cur = local_conn.cursor()
local_cur.execute("""
    SELECT id, payment_id
    FROM payments
    ORDER BY created_at
""")
local_payments = local_cur.fetchall()
local_ids = {row[0] for row in local_payments}
local_payment_ids = {row[1] for row in local_payments if row[1]}
print(f"✅ Found {len(local_payments)} payments in LOCAL database")

# Find missing payments
missing_payments = []
for payment in supabase_payments:
    payment_id_val = payment[1]
    payment_id_obj = payment[0]
    
    # Check if payment exists by ID or payment_id
    if payment_id_obj not in local_ids and (not payment_id_val or payment_id_val not in local_payment_ids):
        missing_payments.append(payment)

print(f"\n📊 Found {len(missing_payments)} missing payments to copy")

if len(missing_payments) == 0:
    print("\n✅ All payments are already in LOCAL database")
    supabase_conn.close()
    local_conn.close()
    sys.exit(0)

# Show first 10 missing payments
print("\nFirst 10 missing payments:")
for i, payment in enumerate(missing_payments[:10]):
    print(f"  {i+1}. UUID: {payment[0]}, payment_id: {payment[1]}")

# Ask for confirmation
print(f"\n⚠️  Ready to copy {len(missing_payments)} payments to LOCAL database")
response = input("Continue? (yes/no): ")

if response.lower() != 'yes':
    print("❌ Cancelled")
    supabase_conn.close()
    local_conn.close()
    sys.exit(0)

# Copy missing payments
print("\n🚀 Copying payments...")
copied = 0
for payment in missing_payments:
    try:
        local_cur.execute("""
            INSERT INTO payments 
            (id, payment_id, counteragent_uuid, project_uuid, financial_code_uuid, 
             currency_uuid, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, payment)
        copied += 1
        if copied % 100 == 0:
            print(f"  Copied {copied}/{len(missing_payments)}...")
    except Exception as e:
        print(f"  ⚠️ Error copying payment {payment[0]}: {e}")

local_conn.commit()
print(f"\n✅ Successfully copied {copied} payments to LOCAL database")

# Verify
local_cur.execute("SELECT COUNT(*) FROM payments")
final_count = local_cur.fetchone()[0]
print(f"✅ LOCAL database now has {final_count} payments")

supabase_conn.close()
local_conn.close()
