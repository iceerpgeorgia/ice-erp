#!/usr/bin/env python3
"""Create NBG exchange rates table in PostgreSQL database."""

import os
import psycopg2
from psycopg2 import sql

def create_nbg_rates_table():
    """Create the nbg_exchange_rates table."""
    
    # Use DATABASE_URL from environment or default connection (remove schema param for psycopg2)
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
    # Remove schema parameter if present (psycopg2 doesn't support it)
    database_url = database_url.split('?')[0]
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print(f"✓ Connected to database")
        
        # Create table
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS nbg_exchange_rates (
          id BIGSERIAL PRIMARY KEY,
          uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
          date DATE NOT NULL,
          usd_rate DECIMAL(18, 6),
          eur_rate DECIMAL(18, 6),
          cny_rate DECIMAL(18, 6),
          gbp_rate DECIMAL(18, 6),
          rub_rate DECIMAL(18, 6),
          try_rate DECIMAL(18, 6),
          aed_rate DECIMAL(18, 6),
          kzt_rate DECIMAL(18, 6),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(date)
        );
        """
        
        cursor.execute(create_table_sql)
        print("✓ Created table: nbg_exchange_rates")
        
        # Create index
        create_index_sql = """
        CREATE INDEX IF NOT EXISTS idx_nbg_exchange_rates_date 
        ON nbg_exchange_rates(date);
        """
        
        cursor.execute(create_index_sql)
        print("✓ Created index: idx_nbg_exchange_rates_date")
        
        # Add comment
        comment_sql = """
        COMMENT ON TABLE nbg_exchange_rates IS 
        'National Bank of Georgia exchange rates - how many GEL per 1 unit of foreign currency';
        """
        
        cursor.execute(comment_sql)
        print("✓ Added table comment")
        
        # Verify table structure
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'nbg_exchange_rates'
            ORDER BY ordinal_position;
        """)
        
        print("\n✓ Table structure:")
        print(f"{'Column':<20} {'Type':<20} {'Nullable':<10}")
        print("-" * 50)
        for row in cursor.fetchall():
            print(f"{row[0]:<20} {row[1]:<20} {row[2]:<10}")
        
        cursor.close()
        conn.close()
        print("\n✅ NBG exchange rates table created successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    create_nbg_rates_table()
