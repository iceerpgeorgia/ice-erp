import psycopg2
import pandas as pd

# SUPABASE connection
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def main():
    # Check database payment_ids
    print("=" * 80)
    print("CHECKING PAYMENT IDS IN SUPABASE DATABASE")
    print("=" * 80)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT payment_id, record_uuid 
            FROM payments 
            LIMIT 10
        """)
        
        print("\nDatabase payment IDs (first 10):")
        for payment_id, record_uuid in cur.fetchall():
            print(f"  payment_id: {payment_id}, record_uuid: {record_uuid}")
        
        # Check template file
        print("\n" + "=" * 80)
        print("CHECKING PAYMENT IDS IN TEMPLATE FILE")
        print("=" * 80)
        
        df = pd.read_excel('templates/payments_import_template.xlsx')
        if 'payment_id' in df.columns:
            print(f"\nTemplate has {len(df)} rows")
            print("\nFirst 10 payment_ids from template:")
            for idx, row in df.head(10).iterrows():
                payment_id = row.get('payment_id', '')
                print(f"  {payment_id}")
            
            print("\n" + "=" * 80)
            print("FORMAT COMPARISON")
            print("=" * 80)
            
            # Get format patterns
            cur.execute("SELECT payment_id FROM payments LIMIT 1")
            db_format = cur.fetchone()[0]
            template_format = df['payment_id'].iloc[0] if len(df) > 0 else None
            
            print(f"\nDatabase format example: {db_format}")
            print(f"Template format example:  {template_format}")
            
            if db_format and template_format:
                if db_format == template_format or db_format.replace('-', '_') == template_format:
                    print("\n✅ Formats MATCH!")
                else:
                    print("\n❌ Formats DO NOT MATCH!")
                    print(f"\nDatabase uses: {db_format} (format: {'P-xxx-xxx-xxx' if '-' in str(db_format) else 'custom'})")
                    print(f"Template uses:  {template_format} (format: {'xxx_xx_xxxx' if '_' in str(template_format) else 'custom'})")
        else:
            print("\n❌ No payment_id column found in template!")
            
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
