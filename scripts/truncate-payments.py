import psycopg2

# SUPABASE connection
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        print("⚠️  WARNING: This will DELETE all payments from the database!")
        print("=" * 80)
        
        # Count current records
        cur.execute("SELECT COUNT(*) FROM payments")
        count = cur.fetchone()[0]
        print(f"Current number of payments: {count}")
        
        confirm = input("\nType 'DELETE ALL PAYMENTS' to confirm: ")
        if confirm != "DELETE ALL PAYMENTS":
            print("❌ Operation cancelled")
            return
        
        print("\nDeleting all payments...")
        cur.execute("TRUNCATE TABLE payments RESTART IDENTITY CASCADE")
        conn.commit()
        
        print("✅ All payments deleted successfully!")
        
        cur.execute("SELECT COUNT(*) FROM payments")
        count = cur.fetchone()[0]
        print(f"Remaining payments: {count}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
