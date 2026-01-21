#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env')

conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
cursor = conn.cursor()

print("\n" + "="*80)
print("CHECKING PAYMENT ID FORMAT IN DATABASE")
print("="*80 + "\n")

cursor.execute("""
    SELECT 
        payment_id,
        counteragent_uuid,
        financial_code_uuid,
        salary_month
    FROM salary_accruals
    LIMIT 3
""")

rows = cursor.fetchall()

for row in rows:
    payment_id = row[0]
    counteragent_uuid = row[1]
    financial_code_uuid = row[2]
    salary_month = row[3]
    
    print(f"Payment ID: {payment_id}")
    print(f"Counteragent UUID: {counteragent_uuid}")
    print(f"Financial Code UUID: {financial_code_uuid}")
    print(f"Salary Month: {salary_month}")
    
    # Extract the parts from payment_id
    parts = payment_id.split('_')
    if len(parts) >= 5:
        counteragent_part = parts[1]  # NP_xxx_NJ
        financial_part = parts[3]      # xxx_PRL
        date_part = parts[4]            # PRLxxxxxx
        
        print(f"\nExtracted from Payment ID:")
        print(f"  Counteragent part: {counteragent_part}")
        print(f"  Financial part: {financial_part}")
        
        # Remove hyphens from UUIDs
        ca_clean = counteragent_uuid.replace('-', '')
        fc_clean = financial_code_uuid.replace('-', '')
        
        print(f"\nUUID without hyphens:")
        print(f"  Counteragent: {ca_clean}")
        print(f"  Financial:    {fc_clean}")
        
        print(f"\nCURRENT algorithm (indices [1,3,5,7,9,11] 0-indexed):")
        current_ca = ca_clean[1] + ca_clean[3] + ca_clean[5] + ca_clean[7] + ca_clean[9] + ca_clean[11]
        current_fc = fc_clean[1] + fc_clean[3] + fc_clean[5] + fc_clean[7] + fc_clean[9] + fc_clean[11]
        print(f"  Counteragent: {current_ca}")
        print(f"  Financial:    {current_fc}")
        print(f"  Match: {current_ca.lower() == counteragent_part.lower() and current_fc.lower() == financial_part.lower()}")
        
        print(f"\nEXCEL algorithm MID(UUID,2,1)..MID(UUID,12,1) on UUID WITH hyphens:")
        # Excel MID is 1-indexed, so MID(text,2,1) means index 1 in 0-indexed
        uuid_with_hyphen = counteragent_uuid
        try:
            excel_ca = uuid_with_hyphen[1] + uuid_with_hyphen[3] + uuid_with_hyphen[5] + uuid_with_hyphen[7] + uuid_with_hyphen[9] + uuid_with_hyphen[11]
            print(f"  Counteragent: {excel_ca}")
        except:
            print(f"  Counteragent: ERROR")
        
        print(f"\nEXCEL algorithm MID(UUID,2,1)..MID(UUID,12,1) on UUID WITHOUT hyphens:")
        excel_ca = ca_clean[1] + ca_clean[3] + ca_clean[5] + ca_clean[7] + ca_clean[9] + ca_clean[11]
        excel_fc = fc_clean[1] + fc_clean[3] + fc_clean[5] + fc_clean[7] + fc_clean[9] + fc_clean[11]
        print(f"  Counteragent: {excel_ca}")
        print(f"  Financial:    {excel_fc}")
        print(f"  Match: {excel_ca.lower() == counteragent_part.lower() and excel_fc.lower() == financial_part.lower()}")
        
    print("\n" + "-"*80 + "\n")

cursor.close()
conn.close()
