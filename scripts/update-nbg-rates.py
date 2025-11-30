#!/usr/bin/env python3
"""
Automatic NBG Exchange Rate Updater Service
Fetches latest exchange rates from National Bank of Georgia API and updates the database.
Should be run daily (recommended after 18:30 Georgian time when rates are published).

Weekend Handling:
- If today is Saturday or Sunday, uses Friday's rates
- NBG doesn't publish rates on weekends
"""

import os
import sys
import psycopg2
import requests
from datetime import datetime, timedelta
from decimal import Decimal
import json

# NBG API endpoint
NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/"

def is_weekend(date):
    """Check if a date is Saturday (5) or Sunday (6)."""
    return date.weekday() >= 5

def get_last_business_day(date):
    """Get the last business day (Friday if weekend)."""
    while is_weekend(date):
        date = date - timedelta(days=1)
    return date

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

def fetch_nbg_rates():
    """Fetch latest exchange rates from NBG API."""
    try:
        print(f"🌐 Fetching rates from NBG API...")
        response = requests.get(NBG_API_URL, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if not data or len(data) == 0:
            print("❌ No data received from NBG API")
            return None
        
        # Parse the response
        # NBG API returns an array with one element containing the rates
        rates_data = data[0] if isinstance(data, list) else data
        
        currencies = rates_data.get('currencies', [])
        date_str = rates_data.get('date', '')
        
        if not date_str:
            print("❌ No date in API response")
            return None
        
        # Parse date (format: "2025-11-12T00:00:00.000Z" or "2025-11-12")
        if 'T' in date_str:
            rate_date = datetime.strptime(date_str.split('T')[0], "%Y-%m-%d").date()
        else:
            rate_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        
        print(f"📅 Rate date: {rate_date}")
        print(f"📊 Currencies in response: {len(currencies)}")
        
        # Build rates dictionary
        rates = {}
        for currency in currencies:
            code = currency.get('code', '')
            quantity = Decimal(str(currency.get('quantity', 1)))
            rate = Decimal(str(currency.get('rate', 0)))
            
            if code and rate > 0:
                # Calculate rate per 1 unit
                rate_per_unit = rate / quantity
                rates[code] = rate_per_unit
                print(f"  ✓ {code}: {quantity} = {rate} GEL → 1 = {rate_per_unit:.6f} GEL")
        
        return {
            'date': rate_date,
            'rates': rates
        }
    
    except requests.RequestException as e:
        print(f"❌ Error fetching from NBG API: {e}")
        return None
    except Exception as e:
        print(f"❌ Error parsing NBG API response: {e}")
        return None

def get_column_name_for_currency(currency_code):
    """Map currency code to database column name."""
    return f"{currency_code.lower()}_rate"

def update_exchange_rates(rate_date, rates):
    """Update exchange rates in the database."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        # Check if this date already exists
        cursor.execute(
            "SELECT id FROM nbg_exchange_rates WHERE date = %s",
            (rate_date,)
        )
        
        existing = cursor.fetchone()
        
        # Get active currencies from our database
        active_currencies = get_active_currencies()
        
        # Build column updates for currencies we support
        column_updates = {}
        for currency_code in active_currencies:
            column_name = get_column_name_for_currency(currency_code)
            rate = rates.get(currency_code)
            column_updates[column_name] = rate
        
        if existing:
            # Update existing record
            print(f"\n📝 Updating existing record for {rate_date}")
            
            set_clauses = [f"{col} = %s" for col in column_updates.keys()]
            set_clauses.append("updated_at = NOW()")
            
            update_sql = f"""
                UPDATE nbg_exchange_rates 
                SET {', '.join(set_clauses)}
                WHERE date = %s
            """
            
            values = list(column_updates.values()) + [rate_date]
            cursor.execute(update_sql, values)
            
            print(f"✅ Updated record for {rate_date}")
        else:
            # Insert new record
            print(f"\n➕ Inserting new record for {rate_date}")
            
            columns = ['date'] + list(column_updates.keys())
            placeholders = ['%s'] * len(columns)
            
            insert_sql = f"""
                INSERT INTO nbg_exchange_rates ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
            """
            
            values = [rate_date] + list(column_updates.values())
            cursor.execute(insert_sql, values)
            
            print(f"✅ Inserted record for {rate_date}")
        
        # Also fill in any missing dates between last record and new record
        # (in case script wasn't run for a few days)
        cursor.execute("""
            SELECT date FROM nbg_exchange_rates 
            ORDER BY date DESC 
            LIMIT 1 OFFSET 1
        """)
        
        previous_date_row = cursor.fetchone()
        if previous_date_row:
            previous_date = previous_date_row[0]
            current_date = previous_date + timedelta(days=1)
            
            filled_count = 0
            while current_date < rate_date:
                # Check if this date exists
                cursor.execute(
                    "SELECT id FROM nbg_exchange_rates WHERE date = %s",
                    (current_date,)
                )
                
                if not cursor.fetchone():
                    # For weekends, use Friday's rates; otherwise copy from previous date
                    if is_weekend(current_date):
                        friday = get_last_business_day(current_date)
                        cursor.execute("""
                            INSERT INTO nbg_exchange_rates 
                            (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
                            SELECT %s, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
                            FROM nbg_exchange_rates
                            WHERE date = %s
                        """, (current_date, friday))
                        print(f"  📅 Filled {current_date} ({'Saturday' if current_date.weekday() == 5 else 'Sunday'}) with Friday ({friday}) rates")
                    else:
                        cursor.execute("""
                            INSERT INTO nbg_exchange_rates 
                            (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
                            SELECT %s, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
                            FROM nbg_exchange_rates
                            WHERE date = %s
                        """, (current_date, previous_date))
                    filled_count += 1
                
                previous_date = current_date
                current_date += timedelta(days=1)
            
            if filled_count > 0:
                print(f"📅 Filled {filled_count} missing dates with appropriate rates")
        
        conn.commit()
        
        # Show updated data
        print(f"\n📊 Current rates in database for {rate_date}:")
        cursor.execute("""
            SELECT usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
            FROM nbg_exchange_rates
            WHERE date = %s
        """, (rate_date,))
        
        row = cursor.fetchone()
        if row:
            labels = ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']
            for i, label in enumerate(labels):
                if row[i]:
                    print(f"  {label}: 1 = {float(row[i]):.6f} GEL")
        
        return True
    
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating database: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        cursor.close()
        conn.close()

def check_for_new_currencies():
    """Check if there are currencies in the currencies table that don't have columns in exchange rates table."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    try:
        # Get active currencies
        active_currencies = get_active_currencies()
        
        # Get existing columns in nbg_exchange_rates
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'nbg_exchange_rates' 
            AND column_name LIKE '%_rate'
        """)
        
        existing_columns = {row[0].replace('_rate', '').upper() for row in cursor.fetchall()}
        
        # Find missing currencies
        missing_currencies = [c for c in active_currencies if c not in existing_columns]
        
        if missing_currencies:
            print(f"\n⚠️  Warning: The following currencies are active but don't have columns in exchange rates table:")
            for currency in missing_currencies:
                print(f"   - {currency}")
            print(f"\n💡 You need to add columns for these currencies to the nbg_exchange_rates table.")
            print(f"   Example SQL:")
            for currency in missing_currencies:
                col_name = get_column_name_for_currency(currency)
                print(f"   ALTER TABLE nbg_exchange_rates ADD COLUMN {col_name} DECIMAL(18, 6);")
        
        return missing_currencies
    
    finally:
        cursor.close()
        conn.close()

def main():
    """Main function to fetch and update exchange rates."""
    print("=" * 60)
    print("NBG Exchange Rate Updater")
    print("=" * 60)
    print(f"🕐 Started at: {datetime.now()}")
    
    today = datetime.now().date()
    
    # Weekend handling
    if is_weekend(today):
        friday = get_last_business_day(today)
        print(f"\n🗓️  Today is {'Saturday' if today.weekday() == 5 else 'Sunday'}")
        print(f"📅 Using Friday's rates ({friday}) for weekend days")
        
        # Fetch Friday's rates from database
        conn = get_database_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
                FROM nbg_exchange_rates
                WHERE date = %s
            """, (friday,))
            
            friday_rates = cursor.fetchone()
            
            if not friday_rates:
                print(f"❌ No rates found for Friday ({friday}). Please run the script on a weekday first.")
                sys.exit(1)
            
            # Build rates dictionary from Friday's data
            rate_columns = ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']
            rates = {rate_columns[i]: Decimal(str(friday_rates[i])) for i in range(len(rate_columns)) if friday_rates[i]}
            
            # Insert for today (Saturday or Sunday)
            success = update_exchange_rates(today, rates)
            
            cursor.close()
            conn.close()
            
            if success:
                print("\n" + "=" * 60)
                print(f"✅ Weekend rates (from Friday) updated successfully for {today}!")
                print("=" * 60)
                sys.exit(0)
            else:
                print("\n" + "=" * 60)
                print("❌ Failed to update weekend rates")
                print("=" * 60)
                sys.exit(1)
                
        except Exception as e:
            print(f"❌ Error handling weekend rates: {e}")
            cursor.close()
            conn.close()
            sys.exit(1)
    
    # Weekday: fetch from NBG API
    # Check for missing currency columns
    missing = check_for_new_currencies()
    if missing:
        print("\n⚠️  Cannot proceed with missing currency columns!")
        sys.exit(1)
    
    # Fetch rates from NBG API
    nbg_data = fetch_nbg_rates()
    
    if not nbg_data:
        print("\n❌ Failed to fetch rates from NBG API")
        sys.exit(1)
    
    # Update database
    success = update_exchange_rates(nbg_data['date'], nbg_data['rates'])
    
    if success:
        print("\n" + "=" * 60)
        print("✅ Exchange rates updated successfully!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("❌ Failed to update exchange rates")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
