#!/usr/bin/env python3
"""Backfill missing NBG exchange rates for specific dates."""

import os
import requests
from datetime import datetime, timedelta
import psycopg2
from decimal import Decimal

def fetch_nbg_rate_for_date(target_date):
    """Fetch NBG rate for a specific date from the API."""
    # NBG API returns the latest available rate, not historical by date
    # So we'll need to use the current endpoint and hope they have the data
    url = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/"
    
    try:
        response = requests.get(url, headers={'Accept': 'application/json'})
        response.raise_for_status()
        data = response.json()
        
        if not data or len(data) == 0:
            return None
        
        rate_data = data[0]
        currencies = rate_data.get('currencies', [])
        date_str = rate_data.get('date', '')
        
        if not date_str:
            return None
        
        # Parse the date
        rate_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
        
        # Build rates dictionary
        rates = {'date': rate_date}
        
        for currency in currencies:
            code = currency.get('code', '').upper()
            quantity = float(currency.get('quantity', 1))
            rate = float(currency.get('rate', 0))
            
            if code and rate > 0:
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
        print(f"Error fetching NBG data: {e}")
        return None

def backfill_missing_dates():
    """Backfill missing dates in the NBG exchange rates table."""
    
    # Database connection
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return
    
    database_url = database_url.split('?')[0]
    
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    print("✓ Connected to database")
    print()
    
    # Find the latest date in database
    cursor.execute("SELECT MAX(date) FROM nbg_exchange_rates")
    latest_date = cursor.fetchone()[0]
    
    if not latest_date:
        print("❌ No existing data in database")
        cursor.close()
        conn.close()
        return
    
    print(f"📅 Latest date in database: {latest_date}")
    
    # Check what dates are missing between latest_date and today
    today = datetime.now().date()
    current_date = latest_date + timedelta(days=1)
    
    missing_dates = []
    while current_date <= today:
        cursor.execute("SELECT id FROM nbg_exchange_rates WHERE date = %s", (current_date,))
        if not cursor.fetchone():
            missing_dates.append(current_date)
        current_date += timedelta(days=1)
    
    if not missing_dates:
        print("✅ No missing dates! Database is up to date.")
        cursor.close()
        conn.close()
        return
    
    print(f"⚠️  Found {len(missing_dates)} missing date(s):")
    for date in missing_dates:
        print(f"   - {date}")
    
    print()
    print("🔄 Filling missing dates with previous day's rates...")
    print()
    
    # For each missing date, use the previous date's rates
    filled_count = 0
    
    for missing_date in missing_dates:
        # Get the most recent rate before this date
        cursor.execute("""
            SELECT usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
            FROM nbg_exchange_rates
            WHERE date < %s
            ORDER BY date DESC
            LIMIT 1
        """, (missing_date,))
        
        previous_rates = cursor.fetchone()
        
        if not previous_rates:
            print(f"   ⏭  Skipping {missing_date} - no previous rates available")
            continue
        
        try:
            # Insert with previous rates
            insert_sql = """
                INSERT INTO nbg_exchange_rates 
                (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (missing_date,) + previous_rates
            cursor.execute(insert_sql, values)
            conn.commit()
            
            filled_count += 1
            usd_rate = float(previous_rates[0]) if previous_rates[0] else 0
            print(f"   ✓ {missing_date} filled with previous rates (USD: {usd_rate:.4f})")
        
        except Exception as e:
            print(f"   ❌ Error filling {missing_date}: {e}")
    
    print()
    print(f"✅ Backfill complete! Filled {filled_count} missing date(s)")
    
    # Show updated statistics
    cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    total_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT MIN(date), MAX(date) FROM nbg_exchange_rates")
    min_date, max_date = cursor.fetchone()
    
    print()
    print("📊 Updated database statistics:")
    print(f"   Total records: {total_count}")
    print(f"   Date range: {min_date} to {max_date}")
    
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

if __name__ == "__main__":
    backfill_missing_dates()
