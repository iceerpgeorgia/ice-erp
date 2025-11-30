#!/usr/bin/env python3
"""Compare Projects table structure with DICT_USERS.xlsx Projects sheet"""

import psycopg2
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

print("=" * 100)
print("PROJECTS TABLE STRUCTURE COMPARISON")
print("=" * 100)

# Get DB structure
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name='projects' 
    ORDER BY ordinal_position
""")

print("\n📊 DATABASE TABLE: projects")
print("-" * 100)
db_columns = []
for row in cur.fetchall():
    col_name, data_type, nullable = row
    db_columns.append(col_name)
    print(f"  {col_name:30} {data_type:25} NULL={nullable}")

cur.close()
conn.close()

# Get Excel structure
df = pd.read_excel('DICT_USERS.xlsx', sheet_name='Projects', nrows=3)
excel_columns = df.columns.tolist()

print(f"\n📊 EXCEL SHEET: Projects (from DICT_USERS.xlsx)")
print("-" * 100)
print(f"  Total columns: {len(excel_columns)}")
for i, col in enumerate(excel_columns, 1):
    print(f"  {i:2}. {col}")

print("\n" + "=" * 100)
print("FIELD MAPPING ANALYSIS")
print("=" * 100)

# Suggest mappings
mappings = {
    'code': 'ნომერი',  # ICE1, ICE2, etc.
    'name': 'პროექტის დასახელება :',
    'contract_number': 'კონტრაქტის # - ',
    'counteragent_id': 'კონტრაგენტი_GUID',
    'financial_code_id': 'შემოსავლის კოდი_GUID',
    'employee_id': 'თანამშრომელი_GUID',
    'amount': 'თანხა :',
    'currency': 'ვალუტა :',
    'start_date': 'თარიღი :',
    'status': 'პროექტის სტატუსი :',
    'oris_id': 'ORIS 1630 :',
    'oris_counteragent_id': 'კონტრაგენტის ORIS ID',
    'uuid': 'პროექტი_GUID/',
    'collateral': 'Collateral',
    'is_deleted': 'Deleted'
}

print("\n🔗 SUGGESTED FIELD MAPPINGS:")
print("-" * 100)
for db_col, excel_col in mappings.items():
    if excel_col in excel_columns:
        print(f"  ✓ {db_col:25} ← {excel_col}")
    else:
        print(f"  ✗ {db_col:25} ← {excel_col} (NOT FOUND)")

print("\n⚠️  UNMAPPED EXCEL COLUMNS:")
print("-" * 100)
mapped_excel = set(mappings.values())
for col in excel_columns:
    if col not in mapped_excel:
        print(f"  • {col}")

print("\n⚠️  UNMAPPED DB COLUMNS:")
print("-" * 100)
mapped_db = set(mappings.keys())
system_cols = {'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'notes'}
for col in db_columns:
    if col not in mapped_db and col not in system_cols:
        print(f"  • {col}")

print("\n" + "=" * 100)
print("SAMPLE DATA (first 3 rows):")
print("=" * 100)
print(df[['ნომერი', 'პროექტის დასახელება :', 'კონტრაგენტი :', 'თანხა :', 'ვალუტა :']].to_string())

print("\n" + "=" * 100)
