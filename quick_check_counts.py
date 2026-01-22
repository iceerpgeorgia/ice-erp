import sys
sys.path.insert(0, '.')

# Import the connection function from the main script
exec(open('import_bank_xml_data.py', encoding='utf-8').read().split('def main(')[0])

# Get connection
try:
    remote_conn, local_conn = get_db_connections()
    print("✅ Connected to Supabase")
    
    cur = remote_conn.cursor()
    
    # Total count
    cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts')
    total = cur.fetchone()[0]
    print(f'\n📊 Total consolidated records: {total:,}')
    
    # Count by account
    cur.execute('''
        SELECT 
            bank_account_uuid, 
            COUNT(*) as record_count
        FROM consolidated_bank_accounts 
        GROUP BY bank_account_uuid 
        ORDER BY record_count DESC
    ''')
    
    print('\n📋 Records per bank account:')
    for row in cur.fetchall():
        print(f'  • {row[0]}: {row[1]:,} records')
    
    # Check the specific account we just backparsed
    target_uuid = '60582948-8c5b-4715-b75c-ca03e3d36a4e'
    cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts WHERE bank_account_uuid = %s', (target_uuid,))
    target_count = cur.fetchone()[0]
    print(f'\n🎯 Account we just backparsed ({target_uuid}): {target_count:,} records')
    
    # Check raw table count
    cur.execute('SELECT COUNT(*) FROM bog_gel_raw_893486000')
    raw_count = cur.fetchone()[0]
    print(f'📦 Raw table (bog_gel_raw_893486000): {raw_count:,} records')
    
    print(f'\n{"="*60}')
    if total != target_count:
        print(f'⚠️  MISMATCH: UI shows {total:,} but we only backparsed {target_count:,}')
        print(f'   Difference: {total - target_count:,} extra records')
    else:
        print(f'✅ Counts match!')
    
    remote_conn.close()
    
except Exception as e:
    print(f'❌ Error: {e}')
    import traceback
    traceback.print_exc()
