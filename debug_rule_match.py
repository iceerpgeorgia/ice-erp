import os
import psycopg2
from urllib.parse import urlparse

# Manually parse .env.local
with open('.env.local', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        line = line.replace('\x00', '').strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ[key] = value

local_url = os.getenv('DATABASE_URL')
parsed = urlparse(local_url)
clean_local = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
conn = psycopg2.connect(clean_local)
cur = conn.cursor()

# Get parsing rules
cur.execute("""
    SELECT id, column_name, condition, payment_id, counteragent_uuid,
           financial_code_uuid, nominal_currency_uuid
    FROM parsing_scheme_rules
    ORDER BY id
""")
rules = cur.fetchall()

print("Parsing Rules Loaded:")
for rule in rules:
    print(f"  Rule ID {rule[0]}:")
    print(f"    Column: {rule[1]}")
    print(f"    Condition: {rule[2]}")
    print(f"    Payment ID: {rule[3]}")
    print(f"    Counteragent UUID: {rule[4]}")
    print(f"    Financial Code UUID: {rule[5]}")
    print(f"    Nominal Currency UUID: {rule[6]}")
    print()

# Get record 335
cur.execute("""
    SELECT id, dockey, entriesid, docprodgroup, counteragent_inn,
           counteragent_processed, parsing_rule_processed, payment_id_processed,
           parsing_rule_applied, parsing_rule_conflict
    FROM bog_gel_raw_893486000
    WHERE id = 335
""")
record = cur.fetchone()

print("Record 335:")
print(f"  ID: {record[0]}")
print(f"  DocKey: {record[1]}")
print(f"  EntriesId: {record[2]}")
print(f"  DocProdGroup: {record[3]}")
print(f"  Counteragent INN: {record[4]}")
print(f"  Counteragent Processed: {record[5]}")
print(f"  Parsing Rule Processed: {record[6]}")
print(f"  Payment ID Processed: {record[7]}")
print(f"  Parsing Rule Applied: {record[8]}")
print(f"  Parsing Rule Conflict: {record[9]}")
print()

# Check if it should match
doc_prod_group = record[3]
print(f"Testing match logic:")
print(f"  Record DocProdGroup: '{doc_prod_group}'")
for rule in rules:
    rule_column = rule[1]
    rule_condition = rule[2]
    print(f"  Rule {rule[0]}: column='{rule_column}', condition='{rule_condition}'")
    
    # The condition format is: docprodgroup="COM"
    if rule_column and rule_condition:
        # Parse condition: column_name="value"
        if '=' in rule_condition:
            parts = rule_condition.split('=')
            if len(parts) == 2:
                cond_column = parts[0].strip().lower()
                cond_value = parts[1].strip().strip('"\'')
                print(f"    Parsed: {cond_column} == {cond_value}")
                print(f"    Match? {cond_column == 'docprodgroup' and doc_prod_group == cond_value}")

conn.close()
