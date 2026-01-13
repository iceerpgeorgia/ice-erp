#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Describe the flags and schema in bog_gel_raw table
"""
import psycopg2
from dotenv import dotenv_values

# Load environment
env = dotenv_values('.env.local')
db_url = env['DATABASE_URL'].split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Find the raw table
cur.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname='public' AND tablename LIKE 'bog_gel_raw%'
    ORDER BY tablename DESC
    LIMIT 1
""")
table_name = cur.fetchone()[0]

print(f"📊 Table: {table_name}\n")

# Get all columns with data types
cur.execute(f"""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = '{table_name}'
    ORDER BY ordinal_position
""")
columns = cur.fetchall()

print("=" * 100)
print("ALL COLUMNS:")
print("=" * 100)
for col in columns:
    nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
    default = f" DEFAULT {col[3]}" if col[3] else ""
    print(f"  {col[0]:30} {col[1]:20} {nullable:10}{default}")

print("\n" + "=" * 100)
print("PROCESSING FLAGS:")
print("=" * 100)

# Get flag columns specifically
flag_columns = [col for col in columns if 'processed' in col[0] or 'inn' in col[0]]
for col in flag_columns:
    nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
    default = f" DEFAULT {col[3]}" if col[3] else ""
    print(f"  {col[0]:30} {col[1]:20} {nullable:10}{default}")

# Check some sample records
print("\n" + "=" * 100)
print("SAMPLE RECORDS (first 3):")
print("=" * 100)

cur.execute(f"""
    SELECT 
        counteragent_processed,
        parsing_rule_processed,
        payment_id_processed,
        is_processed,
        counteragent_inn,
        DocSenderInn,
        DocBenefInn
    FROM {table_name}
    LIMIT 3
""")
samples = cur.fetchall()

print(f"\n{'counteragent_processed':<25} {'parsing_rule_processed':<25} {'payment_id_processed':<25} {'is_processed':<15} {'counteragent_inn':<15}")
print("-" * 120)
for sample in samples:
    print(f"{str(sample[0]):<25} {str(sample[1]):<25} {str(sample[2]):<25} {str(sample[3]):<15} {str(sample[4]):<15}")

# Check distribution
print("\n" + "=" * 100)
print("FLAG DISTRIBUTION:")
print("=" * 100)

cur.execute(f"SELECT COUNT(*) FROM {table_name}")
total = cur.fetchone()[0]

cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE counteragent_processed = TRUE")
ca_processed = cur.fetchone()[0]

cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE parsing_rule_processed = TRUE")
rule_processed = cur.fetchone()[0]

cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE payment_id_processed = TRUE")
payment_processed = cur.fetchone()[0]

cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE is_processed = TRUE")
fully_processed = cur.fetchone()[0]

print(f"  Total records:                 {total}")
print(f"  counteragent_processed=TRUE:   {ca_processed} ({ca_processed/total*100:.1f}%)")
print(f"  parsing_rule_processed=TRUE:   {rule_processed} ({rule_processed/total*100:.1f}%)")
print(f"  payment_id_processed=TRUE:     {payment_processed} ({payment_processed/total*100:.1f}%)")
print(f"  is_processed=TRUE:             {fully_processed} ({fully_processed/total*100:.1f}%)")

conn.close()
