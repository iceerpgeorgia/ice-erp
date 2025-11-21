#!/usr/bin/env python3
"""Bidirectional sync: NBG rates local→Supabase, other tables Supabase→local."""

import os
import psycopg2
from datetime import datetime

def get_local_connection():
    """Connect to local PostgreSQL."""
    local_url = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
    return psycopg2.connect(local_url)

def get_supabase_connection():
    """Connect to Supabase."""
    supabase_url = os.getenv("REMOTE_DATABASE_URL")
    if not supabase_url:
        raise ValueError("REMOTE_DATABASE_URL must be set")
    
    if 'pgbouncer=true' in supabase_url:
        supabase_url = supabase_url.replace('?pgbouncer=true&connection_limit=1', '')
    
    return psycopg2.connect(supabase_url)

def sync_nbg_to_supabase(local_conn, supabase_conn):
    """Sync NBG exchange rates from local to Supabase."""
    print("\n" + "=" * 70)
    print("SYNCING NBG RATES: LOCAL → SUPABASE")
    print("=" * 70)
    
    local_cur = local_conn.cursor()
    supabase_cur = supabase_conn.cursor()
    
    # Get local NBG rates
    print("Fetching NBG rates from local database...")
    local_cur.execute("SELECT * FROM nbg_exchange_rates ORDER BY date")
    local_rates = local_cur.fetchall()
    print(f"✓ Found {len(local_rates)} NBG rates in local database")
    
    # Clear Supabase NBG rates
    print("Clearing Supabase nbg_exchange_rates table...")
    supabase_cur.execute("DELETE FROM nbg_exchange_rates")
    print("✓ Cleared Supabase nbg_exchange_rates")
    
    # Get column names
    local_cur.execute("SELECT * FROM nbg_exchange_rates LIMIT 0")
    columns = [desc[0] for desc in local_cur.description]
    
    # Insert in batches
    batch_size = 500
    total = len(local_rates)
    
    for i in range(0, total, batch_size):
        batch = local_rates[i:i + batch_size]
        
        placeholders = ','.join(['%s'] * len(columns))
        insert_query = f"""
            INSERT INTO nbg_exchange_rates ({','.join(columns)})
            VALUES ({placeholders})
        """
        
        supabase_cur.executemany(insert_query, batch)
        print(f"  ✓ Inserted batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size} ({min(i + batch_size, total)} records)")
    
    # Reset sequence
    supabase_cur.execute("""
        SELECT setval('nbg_exchange_rates_id_seq', 
                      COALESCE((SELECT MAX(id) FROM nbg_exchange_rates), 1))
    """)
    
    supabase_conn.commit()
    print(f"✓ Total inserted: {total} NBG rates into Supabase")
    print("✓ Reset nbg_exchange_rates_id_seq")

def sync_counteragents_from_supabase(local_conn, supabase_conn):
    """Sync counteragents from Supabase to local."""
    print("\n" + "=" * 70)
    print("SYNCING COUNTERAGENTS: SUPABASE → LOCAL")
    print("=" * 70)
    
    local_cur = local_conn.cursor()
    supabase_cur = supabase_conn.cursor()
    
    # Get Supabase counteragents
    print("Fetching counteragents from Supabase...")
    supabase_cur.execute("SELECT * FROM counteragents ORDER BY id")
    supabase_counteragents = supabase_cur.fetchall()
    print(f"✓ Found {len(supabase_counteragents)} counteragents in Supabase")
    
    # Clear local counteragents
    print("Clearing local counteragents table...")
    local_cur.execute("DELETE FROM counteragents")
    print("✓ Cleared local counteragents")
    
    # Get column names
    supabase_cur.execute("SELECT * FROM counteragents LIMIT 0")
    columns = [desc[0] for desc in supabase_cur.description]
    
    # Insert in batches
    batch_size = 500
    total = len(supabase_counteragents)
    
    for i in range(0, total, batch_size):
        batch = supabase_counteragents[i:i + batch_size]
        
        placeholders = ','.join(['%s'] * len(columns))
        insert_query = f"""
            INSERT INTO counteragents ({','.join(columns)})
            VALUES ({placeholders})
        """
        
        local_cur.executemany(insert_query, batch)
        print(f"  ✓ Inserted batch {i//batch_size + 1}/{(total + batch_size - 1)//batch_size} ({min(i + batch_size, total)} records)")
    
    # Reset sequence
    local_cur.execute("""
        SELECT setval('counteragents_id_seq', 
                      COALESCE((SELECT MAX(id) FROM counteragents), 1))
    """)
    
    local_conn.commit()
    print(f"✓ Total inserted: {total} counteragents into local")
    print("✓ Reset counteragents_id_seq")

def sync_currencies_from_supabase(local_conn, supabase_conn):
    """Sync currencies from Supabase to local."""
    print("\n" + "=" * 70)
    print("SYNCING CURRENCIES: SUPABASE → LOCAL")
    print("=" * 70)
    
    local_cur = local_conn.cursor()
    supabase_cur = supabase_conn.cursor()
    
    # Get Supabase currencies
    print("Fetching currencies from Supabase...")
    supabase_cur.execute("SELECT * FROM currencies ORDER BY id")
    supabase_currencies = supabase_cur.fetchall()
    print(f"✓ Found {len(supabase_currencies)} currencies in Supabase")
    
    # Clear local currencies
    print("Clearing local currencies table...")
    local_cur.execute("DELETE FROM currencies")
    print("✓ Cleared local currencies")
    
    # Get column names
    supabase_cur.execute("SELECT * FROM currencies LIMIT 0")
    columns = [desc[0] for desc in supabase_cur.description]
    
    # Insert all
    placeholders = ','.join(['%s'] * len(columns))
    insert_query = f"""
        INSERT INTO currencies ({','.join(columns)})
        VALUES ({placeholders})
    """
    
    local_cur.executemany(insert_query, supabase_currencies)
    
    # Reset sequence
    local_cur.execute("""
        SELECT setval('currencies_id_seq', 
                      COALESCE((SELECT MAX(id) FROM currencies), 1))
    """)
    
    local_conn.commit()
    print(f"✓ Inserted {len(supabase_currencies)} currencies into local")
    print("✓ Reset currencies_id_seq")

def verify_sync(local_conn, supabase_conn):
    """Verify sync counts."""
    print("\n" + "=" * 70)
    print("VERIFICATION")
    print("=" * 70)
    
    local_cur = local_conn.cursor()
    supabase_cur = supabase_conn.cursor()
    
    # NBG rates
    local_cur.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    local_nbg = local_cur.fetchone()[0]
    
    supabase_cur.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    supabase_nbg = supabase_cur.fetchone()[0]
    
    print(f"NBG rates: Local={local_nbg}, Supabase={supabase_nbg} {'✓' if local_nbg == supabase_nbg else '✗'}")
    
    # Counteragents
    local_cur.execute("SELECT COUNT(*) FROM counteragents")
    local_ca = local_cur.fetchone()[0]
    
    supabase_cur.execute("SELECT COUNT(*) FROM counteragents")
    supabase_ca = supabase_cur.fetchone()[0]
    
    print(f"Counteragents: Local={local_ca}, Supabase={supabase_ca} {'✓' if local_ca == supabase_ca else '✗'}")
    
    # Currencies
    local_cur.execute("SELECT COUNT(*) FROM currencies")
    local_curr = local_cur.fetchone()[0]
    
    supabase_cur.execute("SELECT COUNT(*) FROM currencies")
    supabase_curr = supabase_cur.fetchone()[0]
    
    print(f"Currencies: Local={local_curr}, Supabase={supabase_curr} {'✓' if local_curr == supabase_curr else '✗'}")

def main():
    print("=" * 70)
    print("BIDIRECTIONAL SYNC")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    print()
    print("Strategy:")
    print("  - NBG rates: LOCAL → SUPABASE")
    print("  - Counteragents: SUPABASE → LOCAL")
    print("  - Currencies: SUPABASE → LOCAL")
    print()
    
    try:
        print("Connecting to databases...")
        local_conn = get_local_connection()
        print("✓ Connected to local PostgreSQL")
        
        supabase_conn = get_supabase_connection()
        print("✓ Connected to Supabase")
        
        # Sync NBG rates from local to Supabase
        sync_nbg_to_supabase(local_conn, supabase_conn)
        
        # Sync counteragents from Supabase to local
        sync_counteragents_from_supabase(local_conn, supabase_conn)
        
        # Sync currencies from Supabase to local
        sync_currencies_from_supabase(local_conn, supabase_conn)
        
        # Verify
        verify_sync(local_conn, supabase_conn)
        
        local_conn.close()
        supabase_conn.close()
        
        print("\n" + "=" * 70)
        print("BIDIRECTIONAL SYNC COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print(f"Finished at: {datetime.now()}")
        
    except Exception as e:
        print(f"\n✗ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
