import sys
sys.path.insert(0, '.')

# Import the connection function from the main script
exec(open('import_bank_xml_data.py', encoding='utf-8').read().split('def main(')[0])

try:
    remote_conn, local_conn = get_db_connections()
    print("✅ Connected to Supabase\n")
    
    cur = remote_conn.cursor()
    
    # 1. Check how many bank accounts have consolidated records
    print("="*70)
    print("CONSOLIDATED RECORDS BY BANK ACCOUNT")
    print("="*70)
    cur.execute('''
        SELECT 
            bank_account_uuid,
            COUNT(*) as record_count,
            MIN(transaction_date) as earliest_date,
            MAX(transaction_date) as latest_date
        FROM consolidated_bank_accounts 
        GROUP BY bank_account_uuid 
        ORDER BY record_count DESC
    ''')
    
    results = cur.fetchall()
    total_consolidated = 0
    for idx, row in enumerate(results, 1):
        total_consolidated += row[1]
        print(f"\n{idx}. Account UUID: {row[0]}")
        print(f"   Records: {row[1]:,}")
        print(f"   Date range: {row[2]} to {row[3]}")
    
    print(f"\n{'='*70}")
    print(f"Total accounts: {len(results)}")
    print(f"Total consolidated records: {total_consolidated:,}")
    print(f"{'='*70}\n")
    
    # 2. Check all raw tables and their record counts
    print("\n" + "="*70)
    print("RAW TABLES IN DATABASE")
    print("="*70)
    cur.execute('''
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'bog_gel_raw_%'
        ORDER BY table_name
    ''')
    
    raw_tables = cur.fetchall()
    print(f"\nFound {len(raw_tables)} raw tables:\n")
    
    for table in raw_tables:
        table_name = table[0]
        try:
            cur.execute(f'SELECT COUNT(*) FROM {table_name}')
            count = cur.fetchone()[0]
            print(f"  • {table_name}: {count:,} records")
        except Exception as e:
            print(f"  • {table_name}: Error - {e}")
    
    # 3. Check the specific account we backparsed
    print("\n" + "="*70)
    print("BACKPARSED ACCOUNT DETAILS")
    print("="*70)
    target_uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e'
    cur.execute('''
        SELECT 
            ba.uuid,
            ba.account_number,
            ba.raw_table_name,
            b.bank_name,
            c.code as currency_code,
            (SELECT COUNT(*) FROM consolidated_bank_accounts WHERE bank_account_uuid = ba.uuid) as consolidated_count
        FROM bank_accounts ba
        LEFT JOIN banks b ON ba.bank_uuid = b.uuid
        LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
        WHERE ba.uuid = %s
    ''', (target_uuid,))
    
    account_info = cur.fetchone()
    if account_info:
        print(f"\nAccount: {account_info[1]} ({account_info[4]})")
        print(f"Bank: {account_info[3]}")
        print(f"Raw table: {account_info[2]}")
        print(f"Consolidated records: {account_info[5]:,}")
        
        # Check raw table count
        if account_info[2]:
            cur.execute(f'SELECT COUNT(*) FROM {account_info[2]}')
            raw_count = cur.fetchone()[0]
            print(f"Raw table records: {raw_count:,}")
            
            if account_info[5] != raw_count:
                print(f"\n⚠️  MISMATCH:")
                print(f"   Raw table: {raw_count:,}")
                print(f"   Consolidated: {account_info[5]:,}")
                print(f"   Difference: {abs(raw_count - account_info[5]):,}")
    
    remote_conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
