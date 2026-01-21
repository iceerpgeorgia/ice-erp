#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env')

search_payment_id = 'NP_be07b5_NJ_1ba0b4_PRL102024'

conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
cursor = conn.cursor()

cursor.execute("""
    SELECT 
        uuid, dockey, entriesid, docvaluedate, docinformation, 
        entrycramt, entrydbamt, docsenderinn, docbenefinn, 
        counteragent_inn, counteragent_processed, payment_id_processed
    FROM bog_gel_raw_893486000
    WHERE LOWER(docinformation) LIKE %s
""", (f'%{search_payment_id.lower()}%',))

rows = cursor.fetchall()

print(f"\n{'='*70}")
print(f"DETAILED RECORDS WITH PAYMENT ID: {search_payment_id}")
print(f"{'='*70}\n")
print(f"Found {len(rows)} record(s)\n")

for i, row in enumerate(rows, 1):
    print(f"Record #{i}:")
    print(f"  UUID:                  {row[0]}")
    print(f"  DocKey:                {row[1]}")
    print(f"  EntriesId:             {row[2]}")
    print(f"  ValueDate:             {row[3]}")
    print(f"  Credit:                {row[5]}")
    print(f"  Debit:                 {row[6]}")
    print(f"  Sender INN:            {row[7]}")
    print(f"  Benef INN:             {row[8]}")
    print(f"  Counteragent INN:      {row[9]}")
    print(f"  Counteragent Processed: {row[10]}")
    print(f"  Payment ID Processed:   {row[11]}")
    print(f"  DocInfo:               {row[4][:200] if row[4] else 'None'}...")
    print()

# Check if these are in consolidated table
print(f"{'='*70}")
print("CHECKING CONSOLIDATED TABLE")
print(f"{'='*70}\n")

for row in rows:
    raw_uuid = row[0]
    cursor.execute("""
        SELECT id, payment_id, counteragent_uuid, processing_case
        FROM consolidated_bank_accounts
        WHERE raw_record_uuid = %s
    """, (raw_uuid,))
    
    cons = cursor.fetchone()
    if cons:
        print(f"✅ UUID {raw_uuid} is in consolidated:")
        print(f"   ID: {cons[0]}")
        print(f"   Payment ID: {cons[1]}")
        print(f"   Counteragent UUID: {cons[2]}")
        print(f"   Processing Case: {cons[3]}")
    else:
        print(f"❌ UUID {raw_uuid} NOT in consolidated")
    print()

cursor.close()
conn.close()
