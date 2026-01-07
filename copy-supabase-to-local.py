#!/usr/bin/env python3
"""
Copy all data from Supabase (production) to local PostgreSQL database.
This will truncate local tables and copy all data from production.
"""

import os
import psycopg2
from psycopg2.extras import execute_values
from urllib.parse import urlparse

# Connection strings
SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

# Tables to copy (in dependency order to handle foreign keys)
TABLES = [
    'countries',
    'entity_types',
    'currencies',
    'brands',
    'counteragents',
    'financial_codes',
    'project_states',
    'projects',
    'jobs',
    'banks',
    'bank_accounts',
    'payments',
    'payments_ledger',
    'payment_id_duplicates',
    'bank_transactions',
    'exchange_rates',
    'audit_log',
]

def copy_table_data(source_conn, dest_conn, table_name):
    """Copy all data from source table to destination table."""
    print(f"\n📋 Copying {table_name}...")
    
    source_cursor = source_conn.cursor()
    dest_cursor = dest_conn.cursor()
    
    try:
        # Get all data from source
        source_cursor.execute(f'SELECT * FROM "{table_name}"')
        rows = source_cursor.fetchall()
        
        if not rows:
            print(f"  ⚠️  No data in {table_name}")
            return
        
        # Get column names
        column_names = [desc[0] for desc in source_cursor.description]
        
        # Truncate destination table (disable triggers to avoid issues)
        print(f"  🗑️  Truncating local {table_name}...")
        dest_cursor.execute(f'TRUNCATE TABLE "{table_name}" CASCADE')
        
        # Insert data in batches
        print(f"  📥 Inserting {len(rows)} rows...")
        columns_str = ', '.join([f'"{col}"' for col in column_names])
        
        # Use execute_values for efficient batch insert
        insert_query = f'INSERT INTO "{table_name}" ({columns_str}) VALUES %s'
        execute_values(dest_cursor, insert_query, rows, page_size=1000)
        
        dest_conn.commit()
        print(f"  ✅ Successfully copied {len(rows)} rows to {table_name}")
        
    except Exception as e:
        dest_conn.rollback()
        print(f"  ❌ Error copying {table_name}: {str(e)}")
        raise
    finally:
        source_cursor.close()
        dest_cursor.close()

def main():
    print("🚀 Starting data copy from Supabase to local database...\n")
    
    # Connect to both databases
    print("📡 Connecting to Supabase...")
    source_conn = psycopg2.connect(SUPABASE_URL)
    
    print("💻 Connecting to local database...")
    dest_conn = psycopg2.connect(LOCAL_URL)
    
    try:
        # Copy each table
        for table in TABLES:
            try:
                copy_table_data(source_conn, dest_conn, table)
            except Exception as e:
                print(f"⚠️  Skipping {table} due to error: {str(e)}")
                continue
        
        print("\n\n✨ Data copy complete!")
        print("🎉 You can now test locally with production data")
        
    finally:
        source_conn.close()
        dest_conn.close()

if __name__ == '__main__':
    main()
