import psycopg2

DB_CONFIG = {
    'host': 'aws-1-eu-west-1.pooler.supabase.com',
    'port': 6543,
    'database': 'postgres',
    'user': 'postgres.fojbzghphznbslqwurrm',
    'password': 'fulebimojviT1985%'
}

test_uuid = '8af77510-7dae-4172-ba12-b51ae1632683'
test_id = 2089

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

print(f"Checking for counteragent UUID: {test_uuid}")
print(f"Checking for counteragent ID: {test_id}")
print("=" * 80)

# Check by ID
cur.execute("SELECT id, counteragent_uuid, name FROM counteragents WHERE id = %s", (test_id,))
row = cur.fetchone()
if row:
    print(f"\n✓ Found by ID {test_id}:")
    print(f"  ID: {row[0]}")
    print(f"  UUID: {row[1]}")
    print(f"  Name: {row[2]}")
else:
    print(f"\n✗ No counteragent found with ID {test_id}")

# Check by UUID (exact match)
cur.execute("SELECT id, counteragent_uuid, name FROM counteragents WHERE counteragent_uuid::text = %s", (test_uuid,))
row = cur.fetchone()
if row:
    print(f"\n✓ Found by UUID (exact match):")
    print(f"  ID: {row[0]}")
    print(f"  UUID: {row[1]}")
    print(f"  Name: {row[2]}")
else:
    print(f"\n✗ No counteragent found with UUID {test_uuid} (exact match)")

# Check by UUID (case insensitive)
cur.execute("SELECT id, counteragent_uuid, name FROM counteragents WHERE UPPER(counteragent_uuid::text) = UPPER(%s)", (test_uuid,))
row = cur.fetchone()
if row:
    print(f"\n✓ Found by UUID (case insensitive):")
    print(f"  ID: {row[0]}")
    print(f"  UUID: {row[1]}")
    print(f"  Name: {row[2]}")
else:
    print(f"\n✗ No counteragent found with UUID {test_uuid} (case insensitive)")

# Check what the validation script is doing
print("\n" + "=" * 80)
print("Testing validation script logic:")
print("=" * 80)

# Simulate what the validation script does
cur.execute("""
    SELECT counteragent_uuid::text FROM counteragents 
    WHERE UPPER(counteragent_uuid::text) = ANY(%s)
""", ([test_uuid.upper()],))
result = cur.fetchall()
if result:
    print(f"✓ UUID found using validation script logic: {result[0][0]}")
else:
    print(f"✗ UUID NOT found using validation script logic")

cur.close()
conn.close()
