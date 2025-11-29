#!/usr/bin/env python3
import os
import psycopg2

def check_dates(db_name, db_url):
    print(f"\n{'='*60}")
    print(f"Checking {db_name}")
    print(f"{'='*60}")
    
    conn = psycopg2.connect(db_url.split('?')[0])
    cur = conn.cursor()
    
    # Check what dates exist
    cur.execute("SELECT date FROM nbg_exchange_rates ORDER BY date DESC LIMIT 20")
    dates = cur.fetchall()
    
    print(f"Last 20 dates in {db_name}:")
    for row in dates:
        print(f"  {row[0]}")
    
    cur.close()
    conn.close()

# Check both databases
local_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
remote_url = os.getenv("REMOTE_DATABASE_URL", "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres")

check_dates("LOCAL DATABASE", local_url)
check_dates("SUPABASE (PRODUCTION)", remote_url)
