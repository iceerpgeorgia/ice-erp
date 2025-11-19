#!/usr/bin/env python3
"""
Universal NBG Exchange Rates Backfill Script

Automatically detects missing dates in the database and fills them
by fetching historical data from the NBG API using the ?date= parameter.

Usage:
    python scripts/backfill-nbg-from-api.py

Environment Variables:
    DATABASE_URL - PostgreSQL connection string (required)
"""

import os
import sys
import psycopg2
import requests
from datetime import datetime, timedelta
from decimal import Decimal

def fetch_nbg_rate_for_date(target_date):
    """
    Fetch NBG exchange rate for a specific date from the API.
    
    Args:
        target_date: datetime.date object
        
    Returns:
        dict with currency rates or None if error
    """
    date_str = target_date.strftime('%Y-%m-%d')
    url = f"https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date={date_str}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data or len(data) == 0:
            return None
        
        rate_data = data[0]
        currencies = rate_data.get('currencies', [])
        returned_date_str = rate_data.get('date', '')
        
        if not returned_date_str:
            return None
        
        # Parse the returned date
        returned_date = datetime.fromisoformat(returned_date_str.replace('Z', '+00:00')).date()
        
        # Build rates dictionary
        rates = {
            'date': returned_date,
            'requested_date': target_date
        }
        
        for currency in currencies:
            code = currency.get('code', '').upper()
            quantity = float(currency.get('quantity', 1))
            rate = float(currency.get('rate', 0))
            
            if code and rate > 0 and quantity > 0:
                rate_per_unit = rate / quantity
                
                if code == 'USD':
                    rates['usd_rate'] = Decimal(str(rate_per_unit))
                elif code == 'EUR':
                    rates['eur_rate'] = Decimal(str(rate_per_unit))
                elif code == 'CNY':
                    rates['cny_rate'] = Decimal(str(rate_per_unit))
                elif code == 'GBP':
                    rates['gbp_rate'] = Decimal(str(rate_per_unit))
                elif code == 'RUB':
                    rates['rub_rate'] = Decimal(str(rate_per_unit))
                elif code == 'TRY':
                    rates['try_rate'] = Decimal(str(rate_per_unit))
                elif code == 'AED':
                    rates['aed_rate'] = Decimal(str(rate_per_unit))
                elif code == 'KZT':
                    rates['kzt_rate'] = Decimal(str(rate_per_unit))
        
        return rates
    
    except Exception as e:
        print(f"   ⚠️  API Error for {date_str}: {e}")
        return None

def backfill_missing_dates(start_date=None, end_date=None):
    """
    Backfill missing dates in the NBG exchange rates table.
    
    Args:
        start_date: datetime.date - Start of range (default: day after latest DB date)
        end_date: datetime.date - End of range (default: yesterday)
    """
    
    # Database connection
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        print("   Usage: export DATABASE_URL='your-connection-string'")
        return 1
    
    # Remove query parameters for psycopg2
    database_url = database_url.split('?')[0]
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        print("✓ Connected to database")
        print()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return 1
    
    # Find the latest date in database if start_date not provided
    if not start_date:
        cursor.execute("SELECT MAX(date) FROM nbg_exchange_rates")
        latest_date = cursor.fetchone()[0]
        
        if not latest_date:
            print("❌ No existing data in database. Please import initial historical data first.")
            cursor.close()
            conn.close()
            return 1
        
        start_date = latest_date + timedelta(days=1)
        print(f"📅 Latest date in database: {latest_date}")
    
    # Default end_date to yesterday (don't fill today, let cron do it)
    if not end_date:
        end_date = (datetime.now() - timedelta(days=1)).date()
    
    print(f"📅 Backfill range: {start_date} to {end_date}")
    print()
    
    # Find missing dates in the range
    missing_dates = []
    current_date = start_date
    
    while current_date <= end_date:
        cursor.execute("SELECT id FROM nbg_exchange_rates WHERE date = %s", (current_date,))
        if not cursor.fetchone():
            missing_dates.append(current_date)
        current_date += timedelta(days=1)
    
    if not missing_dates:
        print("✅ No missing dates! Database is up to date.")
        cursor.close()
        conn.close()
        return 0
    
    print(f"⚠️  Found {len(missing_dates)} missing date(s):")
    for date in missing_dates[:10]:  # Show first 10
        print(f"   - {date}")
    if len(missing_dates) > 10:
        print(f"   ... and {len(missing_dates) - 10} more")
    print()
    
    # Fetch and insert missing dates
    print("🔄 Fetching rates from NBG API...")
    print()
    
    filled_count = 0
    skipped_count = 0
    error_count = 0
    
    for missing_date in missing_dates:
        # Fetch from API
        rates = fetch_nbg_rate_for_date(missing_date)
        
        if not rates:
            print(f"   ⏭  Skipping {missing_date} - API returned no data")
            skipped_count += 1
            continue
        
        returned_date = rates.get('date')
        
        # Check if we got data for a different date (weekend scenario)
        if returned_date != missing_date:
            print(f"   📅 {missing_date} → API returned {returned_date} (weekend/holiday)")
        
        # Check if we have all required rates
        required_rates = ['usd_rate', 'eur_rate', 'cny_rate', 'gbp_rate', 'rub_rate', 'try_rate', 'aed_rate', 'kzt_rate']
        if not all(rate in rates for rate in required_rates):
            print(f"   ⚠️  {missing_date} - Incomplete data from API, skipping")
            skipped_count += 1
            continue
        
        try:
            # Insert with the requested date (not the returned date)
            # This maintains continuous date sequence even for weekends
            insert_sql = """
                INSERT INTO nbg_exchange_rates 
                (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (date) DO UPDATE SET
                    usd_rate = EXCLUDED.usd_rate,
                    eur_rate = EXCLUDED.eur_rate,
                    cny_rate = EXCLUDED.cny_rate,
                    gbp_rate = EXCLUDED.gbp_rate,
                    rub_rate = EXCLUDED.rub_rate,
                    try_rate = EXCLUDED.try_rate,
                    aed_rate = EXCLUDED.aed_rate,
                    kzt_rate = EXCLUDED.kzt_rate
            """
            
            values = (
                missing_date,
                rates['usd_rate'],
                rates['eur_rate'],
                rates['cny_rate'],
                rates['gbp_rate'],
                rates['rub_rate'],
                rates['try_rate'],
                rates['aed_rate'],
                rates['kzt_rate']
            )
            
            cursor.execute(insert_sql, values)
            conn.commit()
            
            filled_count += 1
            usd_val = float(rates['usd_rate'])
            eur_val = float(rates['eur_rate'])
            print(f"   ✅ {missing_date}: USD={usd_val:.4f}, EUR={eur_val:.4f}")
        
        except Exception as e:
            print(f"   ❌ Error inserting {missing_date}: {e}")
            error_count += 1
            conn.rollback()
    
    print()
    print("=" * 80)
    print()
    print(f"✅ Backfill complete!")
    print(f"   ✓ Filled: {filled_count} dates")
    if skipped_count > 0:
        print(f"   ⏭  Skipped: {skipped_count} dates (no API data)")
    if error_count > 0:
        print(f"   ❌ Errors: {error_count} dates")
    
    # Show updated statistics
    cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    total_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT MIN(date), MAX(date) FROM nbg_exchange_rates")
    min_date, max_date = cursor.fetchone()
    
    print()
    print("📊 Database statistics:")
    print(f"   Total records: {total_count:,}")
    print(f"   Date range: {min_date} to {max_date}")
    
    # Check for remaining gaps
    cursor.execute("""
        WITH date_series AS (
            SELECT generate_series(
                (SELECT MIN(date) FROM nbg_exchange_rates),
                (SELECT MAX(date) FROM nbg_exchange_rates),
                interval '1 day'
            )::date AS date
        )
        SELECT COUNT(*)
        FROM date_series ds
        LEFT JOIN nbg_exchange_rates nbg ON ds.date = nbg.date
        WHERE nbg.date IS NULL
    """)
    
    gaps = cursor.fetchone()[0]
    if gaps > 0:
        print(f"   ⚠️  Gaps remaining: {gaps} dates (may be future dates or API limitations)")
    else:
        print(f"   ✅ No gaps! Complete continuous date coverage")
    
    # Show last 5 dates
    print()
    print("📋 Last 5 dates in database:")
    cursor.execute("""
        SELECT date, usd_rate, eur_rate
        FROM nbg_exchange_rates
        ORDER BY date DESC
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        date, usd, eur = row
        usd_val = float(usd) if usd else 0
        eur_val = float(eur) if eur else 0
        print(f"   {date}: USD={usd_val:.4f}, EUR={eur_val:.4f}")
    
    cursor.close()
    conn.close()
    
    return 0 if error_count == 0 else 1

if __name__ == "__main__":
    print("=" * 80)
    print("NBG Exchange Rates - Universal Backfill Script")
    print("=" * 80)
    print()
    
    # You can also pass start and end dates as arguments
    start_date = None
    end_date = None
    
    if len(sys.argv) > 1:
        try:
            start_date = datetime.strptime(sys.argv[1], '%Y-%m-%d').date()
            print(f"Using start date from argument: {start_date}")
        except ValueError:
            print(f"Invalid start date format: {sys.argv[1]}")
            print("Use: YYYY-MM-DD")
            sys.exit(1)
    
    if len(sys.argv) > 2:
        try:
            end_date = datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
            print(f"Using end date from argument: {end_date}")
        except ValueError:
            print(f"Invalid end date format: {sys.argv[2]}")
            print("Use: YYYY-MM-DD")
            sys.exit(1)
    
    exit_code = backfill_missing_dates(start_date, end_date)
    sys.exit(exit_code)
