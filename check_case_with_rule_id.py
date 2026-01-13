import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/next_starter')
cur = conn.cursor()

cur.execute("""
    SELECT c.processing_case, r.applied_rule_id 
    FROM consolidated_bank_accounts c 
    JOIN bog_gel_raw_893486000 r ON c.raw_record_uuid = r.uuid 
    WHERE r.applied_rule_id IS NOT NULL 
    LIMIT 10
""")

rows = cur.fetchall()
print("Checking if Case column includes Rule IDs:")
print("=" * 80)
for row in rows:
    print(f"Case: {row[0]}")
    print(f"Rule ID in raw table: {row[1]}")
    print("-" * 80)

conn.close()
