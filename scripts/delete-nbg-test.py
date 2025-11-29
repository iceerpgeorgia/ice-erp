#!/usr/bin/env python3
import os
import psycopg2

def delete_records(db_name, db_url):
    print(f"\n{'='*60}")
    print(f"Deleting from {db_name}")
    print(f"{'='*60}")
    
    conn = psycopg2.connect(db_url.split('?')[0])
    cur = conn.cursor()
    
    # Delete records from 2025-11-20 onwards
    cur.execute("DELETE FROM nbg_exchange_rates WHERE date >= '2025-11-20'")
    deleted = cur.rowcount
    conn.commit()
    
    print(f"✅ Deleted {deleted} records from 2025-11-20 onwards")
    
    cur.close()
    conn.close()

# Delete from both databases
local_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
remote_url = os.getenv("REMOTE_DATABASE_URL", "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres")

delete_records("LOCAL DATABASE", local_url)
delete_records("SUPABASE (PRODUCTION)", remote_url)
