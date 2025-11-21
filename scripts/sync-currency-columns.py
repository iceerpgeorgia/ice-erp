#!/usr/bin/env python3
"""
Add missing currency columns to nbg_exchange_rates table.
Run this after adding new currencies to the currencies table.
"""

import os
import psycopg2

def get_database_connection():
    """Get database connection."""
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
    database_url = database_url.split('?')[0]
    return psycopg2.connect(database_url)

def get_active_currencies():
    """Get list of active currency codes from the currencies table."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT code FROM currencies 
        WHERE is_active = true AND code != 'GEL'
        ORDER BY code
    """)
    
    currencies = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    
    return currencies

def get_existing_rate_columns():
    """Get existing rate columns from nbg_exchange_rates table."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'nbg_exchange_rates' 
        AND column_name LIKE '%_rate'
        ORDER BY column_name
    """)
    
    columns = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    
    return columns

def add_currency_column(currency_code):
    """Add a new currency rate column to the table."""
    conn = get_database_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        column_name = f"{currency_code.lower()}_rate"
        
        # Add column
        alter_sql = f"""
            ALTER TABLE nbg_exchange_rates 
            ADD COLUMN IF NOT EXISTS {column_name} DECIMAL(18, 6)
        """
        
        cursor.execute(alter_sql)
        print(f"  ✓ Added column: {column_name}")
        
        # Add comment
        comment_sql = f"""
            COMMENT ON COLUMN nbg_exchange_rates.{column_name} 
            IS '{currency_code}/GEL exchange rate (how many GEL per 1 {currency_code})'
        """
        
        cursor.execute(comment_sql)
        
        return True
    
    except Exception as e:
        print(f"  ❌ Error adding column {currency_code.lower()}_rate: {e}")
        return False
    
    finally:
        cursor.close()
        conn.close()

def sync_currency_columns():
    """Sync currency columns between currencies table and nbg_exchange_rates table."""
    print("=" * 60)
    print("NBG Exchange Rates - Currency Column Sync")
    print("=" * 60)
    
    # Get active currencies
    active_currencies = get_active_currencies()
    print(f"\n📊 Active currencies in database: {len(active_currencies)}")
    print(f"   {', '.join(active_currencies)}")
    
    # Get existing columns
    existing_columns = get_existing_rate_columns()
    existing_currency_codes = {col.replace('_rate', '').upper() for col in existing_columns}
    
    print(f"\n📊 Existing rate columns: {len(existing_columns)}")
    print(f"   {', '.join(sorted(existing_currency_codes))}")
    
    # Find missing currencies
    missing_currencies = [c for c in active_currencies if c not in existing_currency_codes]
    
    if not missing_currencies:
        print(f"\n✅ All active currencies have corresponding columns!")
        print(f"   No action needed.")
        return
    
    print(f"\n⚠️  Missing columns for {len(missing_currencies)} currencies:")
    for currency in missing_currencies:
        print(f"   - {currency}")
    
    # Add missing columns
    print(f"\n💾 Adding missing columns...")
    
    success_count = 0
    for currency in missing_currencies:
        if add_currency_column(currency):
            success_count += 1
    
    print(f"\n✅ Added {success_count}/{len(missing_currencies)} columns successfully!")
    
    # Show updated structure
    updated_columns = get_existing_rate_columns()
    updated_currency_codes = {col.replace('_rate', '').upper() for col in updated_columns}
    
    print(f"\n📊 Updated rate columns: {len(updated_columns)}")
    print(f"   {', '.join(sorted(updated_currency_codes))}")
    
    print("\n" + "=" * 60)
    print("✅ Currency column sync complete!")
    print("=" * 60)
    print("\n💡 Next step: Run 'python scripts/update-nbg-rates.py' to fetch latest rates")

if __name__ == "__main__":
    sync_currency_columns()
