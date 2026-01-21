#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Get connection strings
local_url = os.getenv('DATABASE_URL')
supabase_url = os.getenv('SUPABASE_DATABASE_URL')

# Clean up local URL (remove pgbouncer parameter)
if local_url and 'pgbouncer' in local_url:
    local_url = local_url.split('?')[0]

print("🔍 Checking parsing rules counts...\n")

# Check local DB
try:
    local_conn = psycopg2.connect(local_url)
    local_cur = local_conn.cursor()
    
    local_cur.execute('SELECT COUNT(*) FROM parsing_scheme_rules')
    local_rules_count = local_cur.fetchone()[0]
    
    local_cur.execute('SELECT COUNT(*) FROM parsing_schemes')
    local_schemes_count = local_cur.fetchone()[0]
    
    print(f"📊 LOCAL DATABASE:")
    print(f"   - parsing_schemes: {local_schemes_count}")
    print(f"   - parsing_scheme_rules: {local_rules_count}")
    
    local_conn.close()
except Exception as e:
    print(f"❌ Error checking local DB: {e}")

# Check Supabase
try:
    supabase_conn = psycopg2.connect(supabase_url)
    supabase_cur = supabase_conn.cursor()
    
    supabase_cur.execute('SELECT COUNT(*) FROM parsing_scheme_rules')
    supabase_rules_count = supabase_cur.fetchone()[0]
    
    supabase_cur.execute('SELECT COUNT(*) FROM parsing_schemes')
    supabase_schemes_count = supabase_cur.fetchone()[0]
    
    print(f"\n📊 SUPABASE DATABASE:")
    print(f"   - parsing_schemes: {supabase_schemes_count}")
    print(f"   - parsing_scheme_rules: {supabase_rules_count}")
    
    supabase_conn.close()
except Exception as e:
    print(f"❌ Error checking Supabase: {e}")
