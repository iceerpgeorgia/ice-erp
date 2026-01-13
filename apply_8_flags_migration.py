#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Apply migration: Add 8 processing flags to raw table
"""
import psycopg2
from dotenv import dotenv_values

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

print(f"📊 Adding 8 processing flags to {table_name}...\n")

# Add columns
columns_to_add = [
    ('counteragent_processed', 'Case 1: Counteragent successfully matched by INN'),
    ('counteragent_inn_blank', 'Case 2: INN column is blank'),
    ('counteragent_inn_nonblank_no_match', 'Case 3: INN exists but no matching counteragent'),
    ('payment_id_match', 'Case 4: Payment ID identified and counteragent matches Case 1'),
    ('payment_id_counteragent_mismatch', 'Case 5: Payment ID conflicts with Case 1 counteragent'),
    ('parsing_rule_match', 'Case 6: Parsing rule matched and counteragent matches Case 1'),
    ('parsing_rule_counteragent_mismatch', 'Case 7: Parsing rule conflicts with Case 1 counteragent'),
    ('parsing_rule_dominance', 'Case 8: Parsing rule overrides payment parameters'),
]

for col_name, description in columns_to_add:
    try:
        cur.execute(f"""
            ALTER TABLE {table_name}
            ADD COLUMN IF NOT EXISTS {col_name} BOOLEAN DEFAULT FALSE
        """)
        print(f"✅ Added column: {col_name}")
        print(f"   Description: {description}\n")
    except Exception as e:
        print(f"⚠️  Column {col_name} might already exist: {e}\n")

conn.commit()

# Create index
try:
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name}_flags 
        ON {table_name} (counteragent_processed, payment_id_match, parsing_rule_match)
    """)
    print(f"✅ Created index on processing flags")
    conn.commit()
except Exception as e:
    print(f"⚠️  Index creation: {e}")

# Verify
cur.execute(f"""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '{table_name}' 
    AND column_name IN (
        'counteragent_processed', 
        'counteragent_inn_blank',
        'counteragent_inn_nonblank_no_match',
        'payment_id_match',
        'payment_id_counteragent_mismatch',
        'parsing_rule_match',
        'parsing_rule_counteragent_mismatch',
        'parsing_rule_dominance'
    )
    ORDER BY column_name
""")
existing_cols = [row[0] for row in cur.fetchall()]

print(f"\n📋 Verification:")
print(f"   Columns added: {len(existing_cols)}/8")
for col in existing_cols:
    print(f"   ✅ {col}")

conn.close()

print(f"\n✅ Migration completed!")
