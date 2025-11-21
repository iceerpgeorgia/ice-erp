#!/usr/bin/env python3
"""Sync currencies and NBG exchange rates from local PostgreSQL to Supabase."""

import os
import psycopg2
from datetime import datetime

def get_local_connection():
    """Connect to local PostgreSQL database."""
    local_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
    local_url = local_url.split('?')[0]
    return psycopg2.connect(local_url)

def get_supabase_connection():
    """Connect to Supabase PostgreSQL database."""
    supabase_url = os.getenv("REMOTE_DATABASE_URL")
    if not supabase_url:
        raise ValueError("REMOTE_DATABASE_URL environment variable not set")
    # Remove pgbouncer parameter for direct connection
    supabase_url = supabase_url.replace('?pgbouncer=true&connection_limit=1', '')
    supabase_url = supabase_url.replace(':6543/', ':5432/')  # Use direct port instead of pooler
    return psycopg2.connect(supabase_url)

def sync_currencies(local_conn, supabase_conn):
    """Sync currencies table from local to Supabase."""
    print("\n" + "="*60)
    print("SYNCING CURRENCIES")
    print("="*60)
    
    local_cursor = local_conn.cursor()
    supabase_cursor = supabase_conn.cursor()
    
    # Get currencies from local
    local_cursor.execute("""
        SELECT id, uuid, code, name, is_active, 
               created_at, updated_at
        FROM currencies
        ORDER BY id
    """)
    local_currencies = local_cursor.fetchall()
    
    print(f"✓ Found {len(local_currencies)} currencies in local database")
    
    # Clear Supabase currencies table
    supabase_cursor.execute("DELETE FROM currencies")
    print(f"✓ Cleared Supabase currencies table")
    
    # Insert currencies into Supabase
    insert_count = 0
    for currency in local_currencies:
        supabase_cursor.execute("""
            INSERT INTO currencies (id, uuid, code, name, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, currency)
        insert_count += 1
    
    supabase_conn.commit()
    print(f"✓ Inserted {insert_count} currencies into Supabase")
    
    # Reset sequence
    supabase_cursor.execute("""
        SELECT setval('currencies_id_seq', 
            (SELECT COALESCE(MAX(id), 1) FROM currencies), 
            true)
    """)
    supabase_conn.commit()
    print("✓ Reset currencies_id_seq")
    
    local_cursor.close()
    supabase_cursor.close()

def sync_nbg_rates(local_conn, supabase_conn):
    """Sync NBG exchange rates from local to Supabase."""
    print("\n" + "="*60)
    print("SYNCING NBG EXCHANGE RATES")
    print("="*60)
    
    local_cursor = local_conn.cursor()
    supabase_cursor = supabase_conn.cursor()
    
    # Get NBG rates from local
    local_cursor.execute("""
        SELECT id, uuid, date, usd_rate, eur_rate, cny_rate, gbp_rate, 
               rub_rate, try_rate, aed_rate, kzt_rate,
               created_at, updated_at
        FROM nbg_exchange_rates
        ORDER BY date
    """)
    local_rates = local_cursor.fetchall()
    
    print(f"✓ Found {len(local_rates)} NBG rates in local database")
    
    # Clear Supabase NBG rates table
    supabase_cursor.execute("DELETE FROM nbg_exchange_rates")
    print(f"✓ Cleared Supabase nbg_exchange_rates table")
    
    # Insert rates into Supabase in batches
    batch_size = 500
    insert_count = 0
    
    for i in range(0, len(local_rates), batch_size):
        batch = local_rates[i:i+batch_size]
        
        for rate in batch:
            supabase_cursor.execute("""
                INSERT INTO nbg_exchange_rates 
                (id, uuid, date, usd_rate, eur_rate, cny_rate, gbp_rate, 
                 rub_rate, try_rate, aed_rate, kzt_rate,
                 created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, rate)
            insert_count += 1
        
        supabase_conn.commit()
        print(f"  ✓ Inserted batch {i//batch_size + 1}/{(len(local_rates)-1)//batch_size + 1} ({insert_count} records)")
    
    print(f"✓ Total inserted: {insert_count} NBG rates into Supabase")
    
    # Reset sequence
    supabase_cursor.execute("""
        SELECT setval('nbg_exchange_rates_id_seq', 
            (SELECT COALESCE(MAX(id), 1) FROM nbg_exchange_rates), 
            true)
    """)
    supabase_conn.commit()
    print("✓ Reset nbg_exchange_rates_id_seq")
    
    local_cursor.close()
    supabase_cursor.close()

def verify_sync(local_conn, supabase_conn):
    """Verify the sync was successful."""
    print("\n" + "="*60)
    print("VERIFICATION")
    print("="*60)
    
    local_cursor = local_conn.cursor()
    supabase_cursor = supabase_conn.cursor()
    
    # Verify currencies
    local_cursor.execute("SELECT COUNT(*) FROM currencies")
    local_count = local_cursor.fetchone()[0]
    
    supabase_cursor.execute("SELECT COUNT(*) FROM currencies")
    supabase_count = supabase_cursor.fetchone()[0]
    
    print(f"\nCurrencies:")
    print(f"  Local:    {local_count} records")
    print(f"  Supabase: {supabase_count} records")
    if local_count == supabase_count:
        print("  ✓ Counts match!")
    else:
        print("  ✗ Counts do NOT match!")
    
    # Verify NBG rates
    local_cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    local_count = local_cursor.fetchone()[0]
    
    supabase_cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    supabase_count = supabase_cursor.fetchone()[0]
    
    print(f"\nNBG Exchange Rates:")
    print(f"  Local:    {local_count} records")
    print(f"  Supabase: {supabase_count} records")
    if local_count == supabase_count:
        print("  ✓ Counts match!")
    else:
        print("  ✗ Counts do NOT match!")
    
    # Show date range
    supabase_cursor.execute("""
        SELECT MIN(date), MAX(date) 
        FROM nbg_exchange_rates
    """)
    min_date, max_date = supabase_cursor.fetchone()
    print(f"\nDate range in Supabase: {min_date} to {max_date}")
    
    # Show latest rates
    supabase_cursor.execute("""
        SELECT date, usd_rate, eur_rate, rub_rate
        FROM nbg_exchange_rates
        ORDER BY date DESC
        LIMIT 3
    """)
    latest = supabase_cursor.fetchall()
    print(f"\nLatest 3 rates in Supabase:")
    for date, usd, eur, rub in latest:
        print(f"  {date}: USD={usd}, EUR={eur}, RUB={rub}")
    
    local_cursor.close()
    supabase_cursor.close()

def main():
    """Main sync function."""
    print("="*60)
    print("SYNC LOCAL DATABASE TO SUPABASE")
    print("="*60)
    print(f"Started at: {datetime.now()}")
    
    try:
        # Connect to databases
        print("\nConnecting to databases...")
        local_conn = get_local_connection()
        print("✓ Connected to local PostgreSQL")
        
        supabase_conn = get_supabase_connection()
        print("✓ Connected to Supabase")
        
        # Sync currencies
        sync_currencies(local_conn, supabase_conn)
        
        # Sync NBG rates
        sync_nbg_rates(local_conn, supabase_conn)
        
        # Verify sync
        verify_sync(local_conn, supabase_conn)
        
        # Close connections
        local_conn.close()
        supabase_conn.close()
        
        print("\n" + "="*60)
        print("SYNC COMPLETED SUCCESSFULLY!")
        print("="*60)
        print(f"Finished at: {datetime.now()}")
        
    except Exception as e:
        print(f"\n✗ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
