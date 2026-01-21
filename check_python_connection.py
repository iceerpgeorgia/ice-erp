import psycopg2
from urllib.parse import urlparse

# Read .env.local
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('REMOTE_DATABASE_URL='):
            remote_db_url = line.split('=', 1)[1].strip('"').strip("'")
            break

parsed = urlparse(remote_db_url)
clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

print(f"\nConnecting to: {parsed.netloc}{parsed.path}")
print(f"Database: {parsed.path[1:]}")  # Remove leading /
print(f"Host: {parsed.hostname}")

try:
    conn = psycopg2.connect(clean_url)
    cur = conn.cursor()
    
    # Check database name
    cur.execute("SELECT current_database()")
    db_name = cur.fetchone()[0]
    print(f"\nConnected to database: {db_name}")
    
    # Check table existence and count
    cur.execute("""
        SELECT COUNT(*) FROM consolidated_bank_accounts
    """)
    count = cur.fetchone()[0]
    print(f"consolidated_bank_accounts records: {count:,}")
    
    # Check latest timestamps
    cur.execute("""
        SELECT MAX(created_at), MAX(updated_at)
        FROM consolidated_bank_accounts
    """)
    max_created, max_updated = cur.fetchone()
    print(f"Latest created_at: {max_created}")
    print(f"Latest updated_at: {max_updated}")
    
    # Check for salary format payment IDs
    cur.execute("""
        SELECT COUNT(*) FROM consolidated_bank_accounts
        WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
    """)
    salary_count = cur.fetchone()[0]
    print(f"Salary format payment IDs: {salary_count}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
