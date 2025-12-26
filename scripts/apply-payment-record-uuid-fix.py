import os
import psycopg2

# SUPABASE connection - direct connection string
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        print("Reading SQL file...")
        with open('scripts/fix-payment-record-uuid.sql', 'r') as f:
            sql = f.read()
        
        print("Updating trigger function to use standard UUID...")
        cur.execute(sql)
        conn.commit()
        print("✅ Trigger function updated successfully!")
        
        print("\nRegenerating record_uuid for all existing payments...")
        cur.execute("""
            UPDATE payments 
            SET record_uuid = gen_random_uuid()::TEXT
        """)
        conn.commit()
        
        cur.execute("SELECT COUNT(*) FROM payments")
        count = cur.fetchone()[0]
        print(f"✅ Updated {count} existing payment records with standard UUIDs!")
        
        print("\nVerifying a few records:")
        cur.execute("SELECT payment_id, record_uuid FROM payments LIMIT 5")
        for row in cur.fetchall():
            print(f"  payment_id: {row[0]}, record_uuid: {row[1]}")
            
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
