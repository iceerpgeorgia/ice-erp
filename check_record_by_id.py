#!/usr/bin/env python3
"""Check record in raw and consolidated tables"""

import psycopg2
import os
from dotenv import load_dotenv
import json

load_dotenv('.env')

search_id = '58836782105_15736156270'

def main():
    print(f"\n{'='*70}")
    print(f"SEARCHING FOR RECORD: {search_id}")
    print(f"{'='*70}\n")
    
    db_url = os.getenv('DATABASE_URL').split('?')[0]
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Parse the ID as dockey_entriesid
    parts = search_id.split('_')
    if len(parts) != 2:
        print("❌ Invalid ID format. Expected: dockey_entriesid")
        return
    
    dockey, entriesid = parts
    
    # Check RAW table
    print(f"🔍 Checking RAW table for DocKey={dockey}, EntriesId={entriesid}...\n")
    cursor.execute("""
        SELECT uuid, dockey, entriesid, docrecdate, docvaluedate, 
               docinformation, entrycramt, entrydbamt, 
               docsenderinn, docbenefinn, counteragent_inn,
               counteragent_processed, payment_id_processed
        FROM bog_gel_raw_893486000
        WHERE dockey = %s AND entriesid = %s
    """, (dockey, entriesid))
    
    raw_record = cursor.fetchone()
    
    if raw_record:
        print("✅ FOUND in RAW table:\n")
        print(f"  UUID:                  {raw_record[0]}")
        print(f"  DocKey:                {raw_record[1]}")
        print(f"  EntriesId:             {raw_record[2]}")
        print(f"  RecDate:               {raw_record[3]}")
        print(f"  ValueDate:             {raw_record[4]}")
        print(f"  DocInformation:        {raw_record[5][:100] if raw_record[5] else 'None'}...")
        print(f"  Credit:                {raw_record[6]}")
        print(f"  Debit:                 {raw_record[7]}")
        print(f"  Sender INN:            {raw_record[8]}")
        print(f"  Benef INN:             {raw_record[9]}")
        print(f"  Counteragent INN:      {raw_record[10]}")
        print(f"  Counteragent Processed: {raw_record[11]}")
        print(f"  Payment ID Processed:   {raw_record[12]}")
        
        # Extract payment ID from DocInformation if present
        doc_info = raw_record[5]
        if doc_info:
            import re
            salary_match = re.search(r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}', doc_info, re.IGNORECASE)
            if salary_match:
                print(f"\n  💰 Salary Payment ID Found: {salary_match.group(0)}")
        
        # Check if it's in consolidated
        raw_uuid = raw_record[0]
        print(f"\n🔍 Checking if this is in CONSOLIDATED table (by raw_record_uuid)...\n")
        cursor.execute("""
            SELECT id, raw_record_uuid, transaction_date, description,
                   counteragent_uuid, payment_id, processing_case
            FROM consolidated_bank_accounts
            WHERE raw_record_uuid = %s
        """, (raw_uuid,))
        
        cons_record = cursor.fetchone()
        
        if cons_record:
            print("✅ FOUND in CONSOLIDATED table:\n")
            print(f"  ID:                {cons_record[0]}")
            print(f"  Raw UUID:          {cons_record[1]}")
            print(f"  Transaction Date:  {cons_record[2]}")
            print(f"  Description:       {cons_record[3][:100] if cons_record[3] else 'None'}...")
            print(f"  Counteragent UUID: {cons_record[4]}")
            print(f"  Payment ID:        {cons_record[5]}")
            print(f"  Processing Case:   {cons_record[6]}")
        else:
            print("❌ NOT FOUND in consolidated table")
            print("   This record exists in raw but hasn't been processed to consolidated")
        
    else:
        print(f"❌ NOT FOUND in RAW table")
        print(f"   No records found with DocKey={dockey}, EntriesId={entriesid}")
    
    print(f"\n{'='*70}\n")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
