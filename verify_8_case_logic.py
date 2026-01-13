#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Verify 8-case flag logic is working correctly
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

print(f"📊 Verifying 8-Case Logic in {table_name}\n")
print("=" * 100)

# Test 1: Exactly ONE of Cases 1, 2, 3 must be TRUE per record
print("\n✅ TEST 1: Exactly ONE counteragent case per record")
print("-" * 100)

cur.execute(f"""
    SELECT COUNT(*),
           SUM(CASE WHEN counteragent_processed THEN 1 ELSE 0 END) +
           SUM(CASE WHEN counteragent_inn_blank THEN 1 ELSE 0 END) +
           SUM(CASE WHEN counteragent_inn_nonblank_no_match THEN 1 ELSE 0 END) as case_count
    FROM {table_name}
    GROUP BY case_count
    ORDER BY case_count
""")
results = cur.fetchall()

for count, case_sum in results:
    if case_sum == 0:
        print(f"  ⚠️  {count} records have NO counteragent case set")
    elif case_sum == 1:
        print(f"  ✅ {count} records have EXACTLY ONE counteragent case set")
    else:
        print(f"  ❌ {count} records have {case_sum} counteragent cases set (should be 1!)")

# Test 2: Case 4 and Case 5 are mutually exclusive
print("\n✅ TEST 2: Case 4 and Case 5 mutually exclusive")
print("-" * 100)

cur.execute(f"""
    SELECT COUNT(*)
    FROM {table_name}
    WHERE payment_id_match = TRUE AND payment_id_counteragent_mismatch = TRUE
""")
both_payment = cur.fetchone()[0]

if both_payment == 0:
    print(f"  ✅ No records have both Case 4 and Case 5 TRUE")
else:
    print(f"  ❌ {both_payment} records have both Case 4 and Case 5 TRUE (invalid!)")

# Test 3: Case 6 and Case 7 are mutually exclusive
print("\n✅ TEST 3: Case 6 and Case 7 mutually exclusive")
print("-" * 100)

cur.execute(f"""
    SELECT COUNT(*)
    FROM {table_name}
    WHERE parsing_rule_match = TRUE AND parsing_rule_counteragent_mismatch = TRUE
""")
both_rule = cur.fetchone()[0]

if both_rule == 0:
    print(f"  ✅ No records have both Case 6 and Case 7 TRUE")
else:
    print(f"  ❌ {both_rule} records have both Case 6 and Case 7 TRUE (invalid!)")

# Test 4: Case 8 only when BOTH Case 4 and Case 6 are TRUE
print("\n✅ TEST 4: Case 8 requires both Case 4 and Case 6")
print("-" * 100)

cur.execute(f"""
    SELECT COUNT(*)
    FROM {table_name}
    WHERE parsing_rule_dominance = TRUE
      AND (payment_id_match = FALSE OR parsing_rule_match = FALSE)
""")
invalid_case8 = cur.fetchone()[0]

if invalid_case8 == 0:
    print(f"  ✅ All Case 8 records have both Case 4 and Case 6 TRUE")
else:
    print(f"  ❌ {invalid_case8} Case 8 records missing Case 4 or Case 6 (invalid!)")

# Test 5: Distribution of all 8 cases
print("\n✅ TEST 5: Flag Distribution")
print("-" * 100)

cur.execute(f"SELECT COUNT(*) FROM {table_name}")
total = cur.fetchone()[0]

cases = [
    ('Case 1: Counteragent matched', 'counteragent_processed'),
    ('Case 2: INN blank', 'counteragent_inn_blank'),
    ('Case 3: INN no match', 'counteragent_inn_nonblank_no_match'),
    ('Case 4: Payment match', 'payment_id_match'),
    ('Case 5: Payment conflict', 'payment_id_counteragent_mismatch'),
    ('Case 6: Rule match', 'parsing_rule_match'),
    ('Case 7: Rule conflict', 'parsing_rule_counteragent_mismatch'),
    ('Case 8: Rule dominance', 'parsing_rule_dominance'),
]

for label, column in cases:
    cur.execute(f"SELECT COUNT(*) FROM {table_name} WHERE {column} = TRUE")
    count = cur.fetchone()[0]
    pct = count / total * 100 if total > 0 else 0
    print(f"  {label:35} {count:6} ({pct:5.1f}%)")

# Test 6: Check Case 8 in detail
print("\n✅ TEST 6: Case 8 Dominance Details")
print("-" * 100)

cur.execute(f"""
    SELECT COUNT(*)
    FROM {table_name}
    WHERE parsing_rule_dominance = TRUE
""")
case8_count = cur.fetchone()[0]

print(f"  Total Case 8 records: {case8_count}")

if case8_count > 0:
    cur.execute(f"""
        SELECT COUNT(*)
        FROM {table_name}
        WHERE parsing_rule_dominance = TRUE
          AND counteragent_processed = TRUE
    """)
    case8_with_case1 = cur.fetchone()[0]
    print(f"  Case 8 with Case 1: {case8_with_case1} ({case8_with_case1/case8_count*100:.1f}%)")
    
    cur.execute(f"""
        SELECT COUNT(*)
        FROM {table_name}
        WHERE parsing_rule_dominance = TRUE
          AND counteragent_inn_blank = TRUE
    """)
    case8_with_case2 = cur.fetchone()[0]
    print(f"  Case 8 with Case 2: {case8_with_case2} ({case8_with_case2/case8_count*100:.1f}%)")

# Test 7: Sample records for each case
print("\n✅ TEST 7: Sample Records")
print("-" * 100)

cur.execute(f"""
    SELECT 
        CASE 
            WHEN counteragent_processed THEN 'Case 1'
            WHEN counteragent_inn_blank THEN 'Case 2'
            WHEN counteragent_inn_nonblank_no_match THEN 'Case 3'
        END as ca_case,
        CASE WHEN payment_id_match THEN 'C4' ELSE '' END as c4,
        CASE WHEN payment_id_counteragent_mismatch THEN 'C5' ELSE '' END as c5,
        CASE WHEN parsing_rule_match THEN 'C6' ELSE '' END as c6,
        CASE WHEN parsing_rule_counteragent_mismatch THEN 'C7' ELSE '' END as c7,
        CASE WHEN parsing_rule_dominance THEN 'C8' ELSE '' END as c8,
        COUNT(*) as count
    FROM {table_name}
    GROUP BY ca_case, c4, c5, c6, c7, c8
    ORDER BY count DESC
    LIMIT 10
""")

print(f"  {'CA Case':<10} {'C4':<5} {'C5':<5} {'C6':<5} {'C7':<5} {'C8':<5} {'Count':<10}")
print(f"  {'-'*10} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*10}")

for row in cur.fetchall():
    ca_case, c4, c5, c6, c7, c8, count = row
    print(f"  {ca_case:<10} {c4:<5} {c5:<5} {c6:<5} {c7:<5} {c8:<5} {count:<10}")

print("\n" + "=" * 100)
print("\n📋 VALIDATION SUMMARY:")

# Count issues
issues = []
if both_payment > 0:
    issues.append(f"Case 4/5 conflict: {both_payment} records")
if both_rule > 0:
    issues.append(f"Case 6/7 conflict: {both_rule} records")
if invalid_case8 > 0:
    issues.append(f"Invalid Case 8: {invalid_case8} records")

if not issues:
    print("✅ All validation tests passed!")
    print("   The 8-case hierarchical logic is working correctly.")
else:
    print("⚠️  Issues found:")
    for issue in issues:
        print(f"   - {issue}")

conn.close()
