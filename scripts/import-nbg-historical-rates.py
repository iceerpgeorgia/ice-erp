#!/usr/bin/env python3
"""Import historical NBG exchange rates from CSV files."""

import os
import csv
import psycopg2
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict

def parse_date(date_str):
    """Parse date string in M/D/YYYY format."""
    return datetime.strptime(date_str, "%m/%d/%Y").date()

def import_historical_rates():
    """Import historical exchange rates from CSV files."""
    
    # Database connection
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
    database_url = database_url.split('?')[0]
    
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print("✓ Connected to database")
    
    # Currency code to column mapping
    currency_columns = {
        'USD': 'usd_rate',
        'EUR': 'eur_rate',
        'CNY': 'cny_rate',
        'GBP': 'gbp_rate',
        'RUB': 'rub_rate',
        'TRY': 'try_rate',
        'AED': 'aed_rate',
        'KZT': 'kzt_rate'
    }
    
    # Dictionary to store all rates by date
    # Structure: {date: {currency_code: rate}}
    rates_by_date = defaultdict(dict)
    
    # Read all CSV files
    csv_folder = "Historical NBG"
    for currency_code, column_name in currency_columns.items():
        csv_file = os.path.join(csv_folder, f"{currency_code}.csv")
        
        if not os.path.exists(csv_file):
            print(f"⚠ Warning: File not found: {csv_file}")
            continue
        
        print(f"\n📂 Reading {csv_file}...")
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
            for row in rows:
                try:
                    # Extract data
                    quantity = Decimal(row['Quantity'])
                    rate = Decimal(row['Rate'])
                    valid_from = parse_date(row['ValidFromDate'])
                    
                    # Calculate rate per 1 unit: Rate / Quantity
                    rate_per_unit = rate / quantity
                    
                    # Store in dictionary
                    rates_by_date[valid_from][currency_code] = rate_per_unit
                    
                except Exception as e:
                    print(f"  ❌ Error processing row: {row}")
                    print(f"     Error: {e}")
        
        print(f"  ✓ Processed {len(rows)} rows for {currency_code}")
    
    # Get all unique dates and sort them
    all_dates = sorted(rates_by_date.keys())
    
    if not all_dates:
        print("\n❌ No data to import!")
        return
    
    print(f"\n📅 Date range: {all_dates[0]} to {all_dates[-1]}")
    print(f"📊 Total unique dates with data: {len(all_dates)}")
    
    # Fill in missing dates (weekends/holidays)
    # For each missing date, use the previous available date's rates
    min_date = all_dates[0]
    max_date = all_dates[-1]
    
    current_date = min_date
    last_known_rates = {}
    complete_rates = {}
    
    while current_date <= max_date:
        if current_date in rates_by_date:
            # Update last known rates
            last_known_rates.update(rates_by_date[current_date])
            complete_rates[current_date] = dict(last_known_rates)
        else:
            # Use last known rates for missing dates
            if last_known_rates:
                complete_rates[current_date] = dict(last_known_rates)
        
        current_date += timedelta(days=1)
    
    print(f"📊 Total dates after filling gaps: {len(complete_rates)}")
    
    # Insert data into database
    print("\n💾 Inserting data into database...")
    
    inserted_count = 0
    skipped_count = 0
    
    for date, rates in sorted(complete_rates.items()):
        try:
            # Check if date already exists
            cursor.execute(
                "SELECT id FROM nbg_exchange_rates WHERE date = %s",
                (date,)
            )
            
            if cursor.fetchone():
                skipped_count += 1
                continue
            
            # Build insert query
            insert_sql = """
                INSERT INTO nbg_exchange_rates 
                (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (
                date,
                rates.get('USD'),
                rates.get('EUR'),
                rates.get('CNY'),
                rates.get('GBP'),
                rates.get('RUB'),
                rates.get('TRY'),
                rates.get('AED'),
                rates.get('KZT')
            )
            
            cursor.execute(insert_sql, values)
            inserted_count += 1
            
            if inserted_count % 100 == 0:
                print(f"  ✓ Inserted {inserted_count} records...")
        
        except Exception as e:
            print(f"  ❌ Error inserting data for {date}: {e}")
    
    conn.commit()
    
    print(f"\n✅ Import complete!")
    print(f"   📊 Inserted: {inserted_count} records")
    print(f"   ⏭  Skipped: {skipped_count} existing records")
    
    # Show sample data
    print("\n📋 Sample data (last 5 dates):")
    cursor.execute("""
        SELECT date, usd_rate, eur_rate, rub_rate, gbp_rate
        FROM nbg_exchange_rates
        ORDER BY date DESC
        LIMIT 5
    """)
    
    print(f"\n{'Date':<12} {'USD':<10} {'EUR':<10} {'RUB':<10} {'GBP':<10}")
    print("-" * 52)
    for row in cursor.fetchall():
        print(f"{row[0]!s:<12} {float(row[1]) if row[1] else 'N/A':<10.6f} "
              f"{float(row[2]) if row[2] else 'N/A':<10.6f} "
              f"{float(row[3]) if row[3] else 'N/A':<10.6f} "
              f"{float(row[4]) if row[4] else 'N/A':<10.6f}")
    
    # Show statistics
    cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    total_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT MIN(date), MAX(date) FROM nbg_exchange_rates")
    min_date, max_date = cursor.fetchone()
    
    print(f"\n📊 Database statistics:")
    print(f"   Total records: {total_count}")
    print(f"   Date range: {min_date} to {max_date}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    import_historical_rates()
