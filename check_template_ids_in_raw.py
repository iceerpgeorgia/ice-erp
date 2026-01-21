#!/usr/bin/env python3
"""Check if template payment IDs exist in raw bank data"""

import psycopg2
import os
from dotenv import load_dotenv
import openpyxl

# Load environment
load_dotenv('.env')

def main():
    print("\n" + "="*70)
    print("CHECKING IF TEMPLATE PAYMENT_IDs EXIST IN RAW BANK DATA")
    print("="*70 + "\n")
    
    # Connect to Supabase
    db_url = os.getenv('DATABASE_URL')
    # Remove pgbouncer parameters for psycopg2
    db_url = db_url.split('?')[0] if '?' in db_url else db_url
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Load template payment IDs
    print("📄 Loading payment IDs from template...")
    wb = openpyxl.load_workbook('templates/salary_accruals_import_template.xlsx', read_only=True)
    ws = wb.worksheets[0]  # Get first sheet
    
    template_payment_ids = set()
    header_row = None
    payment_id_col = None
    
    for idx, row in enumerate(ws.iter_rows(values_only=True), 1):
        if idx == 1:
            header_row = row
            # Find payment_id column
            for col_idx, header in enumerate(header_row):
                if header and 'payment' in str(header).lower():
                    payment_id_col = col_idx
                    break
            continue
        
        if payment_id_col is not None and row[payment_id_col]:
            template_payment_ids.add(str(row[payment_id_col]).strip())
    
    wb.close()
    print(f"   Found {len(template_payment_ids)} payment IDs in template\n")
    
    # Get sample template IDs
    sample_template = list(template_payment_ids)[:10]
    print("   Sample template IDs:")
    for pid in sample_template:
        print(f"     - {pid}")
    print()
    
    # Check raw table
    print("🔍 Checking raw table bog_gel_raw_893486000...")
    
    # Count total records with salary pattern
    cursor.execute("""
        SELECT COUNT(*)
        FROM bog_gel_raw_893486000
        WHERE docinformation ~* 'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL[0-9]{6}'
    """)
    total_salary_pattern = cursor.fetchone()[0]
    print(f"   Total records with salary pattern: {total_salary_pattern}\n")
    
    # Get all unique payment IDs from raw table
    print("📊 Extracting payment IDs from raw table...")
    cursor.execute("""
        SELECT DISTINCT docinformation
        FROM bog_gel_raw_893486000
        WHERE docinformation ~* 'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL[0-9]{6}'
    """)
    
    raw_payment_ids = set()
    for row in cursor.fetchall():
        doc_info = row[0]
        # Extract payment ID using regex
        import re
        match = re.search(r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}', doc_info, re.IGNORECASE)
        if match:
            raw_payment_ids.add(match.group(0).upper())
    
    print(f"   Found {len(raw_payment_ids)} unique salary payment IDs in raw table\n")
    
    # Get sample raw IDs
    sample_raw = list(raw_payment_ids)[:10]
    print("   Sample raw IDs:")
    for pid in sample_raw:
        print(f"     - {pid}")
    print()
    
    # Check overlap
    print("🔍 Checking overlap...\n")
    
    # Normalize template IDs to uppercase for comparison
    template_payment_ids_upper = {pid.upper() for pid in template_payment_ids}
    
    overlap = template_payment_ids_upper & raw_payment_ids
    
    print(f"   Template IDs:     {len(template_payment_ids)}")
    print(f"   Raw table IDs:    {len(raw_payment_ids)}")
    print(f"   OVERLAP:          {len(overlap)}")
    
    if len(overlap) > 0:
        print(f"\n   ✅ FOUND {len(overlap)} MATCHES!")
        print(f"   {(len(overlap)/len(template_payment_ids)*100):.2f}% of template IDs are in raw data\n")
        print("   Sample matches:")
        for pid in list(overlap)[:10]:
            print(f"     - {pid}")
    else:
        print("\n   ❌ NO OVERLAP - Template IDs don't exist in raw bank data")
        print("      This means the bank statements are from different time periods\n")
    
    print("\n" + "="*70)
    print("CONCLUSION:")
    if len(overlap) > 0:
        print("  The template payment IDs (old algorithm) ARE present in raw data")
        print("  This suggests the bank data was imported when the old algorithm")
        print("  was being used for salary accruals.")
    else:
        print("  The template payment IDs (old algorithm) are NOT in raw data")
        print("  Bank statements and salary accruals are from different periods.")
    print("="*70 + "\n")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
