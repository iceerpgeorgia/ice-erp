import psycopg2
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from import_bank_xml_data import get_db_connections

supabase_conn, local_conn = get_db_connections()
cur = local_conn.cursor()

# Check raw table
print("=" * 80)
print("RAW TABLE - bog_gel_raw_893486000 - Record ID 281")
print("=" * 80)
cur.execute("""
    SELECT id, 
           counteragent_processed, 
           counteragent_inn_blank, 
           counteragent_inn_nonblank_no_match, 
           payment_id_match, 
           payment_id_counteragent_mismatch, 
           parsing_rule_match, 
           parsing_rule_counteragent_mismatch, 
           parsing_rule_dominance, 
           docsenderinn,
           docbenefinn,
           entrydbamt,
           entrycramt,
           docprodgroup
    FROM bog_gel_raw_893486000 
    WHERE id = 281
""")
row = cur.fetchone()
if row:
    print(f"ID: {row[0]}")
    print(f"case1_counteragent_processed: {row[1]}")
    print(f"case2_counteragent_inn_blank: {row[2]}")
    print(f"case3_counteragent_inn_nonblank_no_match: {row[3]}")
    print(f"case4_payment_id_match: {row[4]}")
    print(f"case5_payment_id_counteragent_mismatch: {row[5]}")
    print(f"case6_parsing_rule_match: {row[6]}")
    print(f"case7_parsing_rule_counteragent_mismatch: {row[7]}")
    print(f"case8_parsing_rule_dominance: {row[8]}")
    print(f"docsenderinn: {row[9]}")
    print(f"docbenefinn: {row[10]}")
    print(f"entrydbamt (debit): {row[11]}")
    print(f"entrycramt (credit): {row[12]}")
    print(f"docprodgroup: {row[13]}")
else:
    print("Record not found")

# Get the uuid from raw table
cur.execute("SELECT uuid FROM bog_gel_raw_893486000 WHERE id = 281")
raw_uuid = cur.fetchone()
if raw_uuid:
    raw_uuid = raw_uuid[0]
    print(f"\nRaw UUID: {raw_uuid}")
    
    # Check consolidated table
    print("\n" + "=" * 80)
    print("CONSOLIDATED TABLE - consolidated_bank_accounts")
    print("=" * 80)
    cur.execute("""
        SELECT uuid, 
               counteragent_uuid, 
               project_uuid, 
               financial_code_uuid,
               nominal_currency_uuid,
               account_currency_uuid,
               processing_case
        FROM consolidated_bank_accounts 
        WHERE raw_record_uuid = %s
    """, (raw_uuid,))
    cons_row = cur.fetchone()
    if cons_row:
        print(f"UUID: {cons_row[0]}")
        print(f"counteragent_uuid: {cons_row[1]}")
        print(f"project_uuid: {cons_row[2]}")
        print(f"financial_code_uuid: {cons_row[3]}")
        print(f"nominal_currency_uuid: {cons_row[4]}")
        print(f"account_currency_uuid: {cons_row[5]}")
        print(f"processing_case:\n{cons_row[6]}")
    else:
        print("Consolidated record not found")

local_conn.close()
supabase_conn.close()
