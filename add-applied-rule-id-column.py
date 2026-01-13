import psycopg2
import os

# Get database URL
db_url = os.getenv('DATABASE_URL')

print("Adding applied_rule_id column to consolidated_bank_accounts...")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute('ALTER TABLE consolidated_bank_accounts ADD COLUMN IF NOT EXISTS applied_rule_id INTEGER')
    conn.commit()
    
    print('✅ Column applied_rule_id added to consolidated_bank_accounts')
    
    cur.close()
    conn.close()
except Exception as e:
    print(f'❌ Error: {e}')
