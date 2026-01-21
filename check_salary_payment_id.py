#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env')

search_payment_id = 'NP_be07b5_NJ_1ba0b4_PRL102024'

conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
cursor = conn.cursor()

print(f"\n{'='*70}")
print(f"CHECKING SALARY_ACCRUALS FOR: {search_payment_id}")
print(f"{'='*70}\n")

cursor.execute("""
    SELECT payment_id, counteragent_uuid, financial_code_uuid, salary_month
    FROM salary_accruals
    WHERE LOWER(payment_id) = LOWER(%s)
""", (search_payment_id,))

row = cursor.fetchone()

if row:
    print("✅ FOUND in salary_accruals!\n")
    print(f"  Payment ID:       {row[0]}")
    print(f"  Counteragent UUID: {row[1]}")
    print(f"  Financial Code:    {row[2]}")
    print(f"  Salary Month:      {row[3]}")
else:
    print("❌ NOT FOUND in salary_accruals")
    print("\nThis payment ID was extracted from bank data but doesn't exist")
    print("in the salary_accruals table, so it wasn't matched during processing.")

print(f"\n{'='*70}\n")

cursor.close()
conn.close()
