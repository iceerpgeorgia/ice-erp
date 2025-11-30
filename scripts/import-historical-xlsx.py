#!/usr/bin/env python3
"""Import NBG rates from Historical Excel files."""

import os
import pandas as pd
import psycopg2
from decimal import Decimal
from datetime import datetime

historical_folder = "Historical NBG"

# Map filenames to currency codes
file_currency_map = {
    'file (7).xlsx': 'USD',
    'file (10).xlsx': 'EUR',
    'file (11).xlsx': 'CNY',
    'file (9).xlsx': 'GBP',
    'file (8).xlsx': 'RUB',
    'file (7)2.xlsx': 'TRY',
    'file (12).xlsx': 'AED',
    'file (13).xlsx': 'KZT',
}

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("✓ Connected to database")
print()
print("📥 Reading Historical NBG Excel files...")
print()

# Dictionary to hold all rates by date
rates_by_date = {}

# Read each Excel file
for filename, currency_code in file_currency_map.items():
    filepath = os.path.join(historical_folder, filename)
    
    if not os.path.exists(filepath):
        print(f"⚠️  File not found: {filename}")
        continue
    
    try:
        df = pd.read_excel(filepath)
        
        # Parse dates and rates
        for _, row in df.iterrows():
            # Use ValidFromDate as the rate date
            date_str = row.get('ValidFromDate') or row.get('Date')
            if pd.isna(date_str):
                continue
            
            date = pd.to_datetime(date_str).date()
            quantity = float(row.get('Quantity', 1))
            rate = float(row.get('Rate', 0))
            
            if rate == 0:
                continue
            
            # Calculate rate per unit
            rate_per_unit = rate / quantity
            
            # Initialize date entry if not exists
            if date not in rates_by_date:
                rates_by_date[date] = {}
            
            # Store the rate
            rates_by_date[date][currency_code] = Decimal(str(rate_per_unit))
        
        print(f"✓ Processed {filename} ({currency_code}): {len(df)} rows")
    
    except Exception as e:
        print(f"❌ Error reading {filename}: {e}")

print()
print(f"📊 Collected rates for {len(rates_by_date)} dates")
print()

# Now update/insert into database
updated_count = 0
inserted_count = 0

for date, rates in sorted(rates_by_date.items()):
    # Check if this date exists
    cursor.execute("SELECT id FROM nbg_exchange_rates WHERE date = %s", (date,))
    existing = cursor.fetchone()
    
    if existing:
        # Update existing record
        update_parts = []
        update_values = []
        
        for currency_code, rate in rates.items():
            column_name = f"{currency_code.lower()}_rate"
            update_parts.append(f"{column_name} = %s")
            update_values.append(rate)
        
        if update_parts:
            update_sql = f"UPDATE nbg_exchange_rates SET {', '.join(update_parts)} WHERE date = %s"
            update_values.append(date)
            cursor.execute(update_sql, update_values)
            conn.commit()
            updated_count += 1
            print(f"✓ Updated {date}: {list(rates.keys())}")
    else:
        # Insert new record
        columns = ['date']
        values = [date]
        
        for currency_code, rate in rates.items():
            column_name = f"{currency_code.lower()}_rate"
            columns.append(column_name)
            values.append(rate)
        
        placeholders = ', '.join(['%s'] * len(values))
        insert_sql = f"INSERT INTO nbg_exchange_rates ({', '.join(columns)}) VALUES ({placeholders})"
        cursor.execute(insert_sql, values)
        conn.commit()
        inserted_count += 1
        print(f"✓ Inserted {date}: {list(rates.keys())}")

print()
print(f"✅ Import complete!")
print(f"   Updated: {updated_count} records")
print(f"   Inserted: {inserted_count} records")

# Verify Nov 17 specifically
print()
print("🔍 Verifying Nov 17, 2025:")
cursor.execute("""
    SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
    WHERE date = '2025-11-17'
""")

result = cursor.fetchone()
if result:
    date, usd, eur, cny, gbp, rub, try_rate, aed, kzt = result
    print(f"   Date: {date}")
    print(f"   USD: {float(usd) if usd else 0:.4f}")
    print(f"   EUR: {float(eur) if eur else 0:.4f}")
    print(f"   CNY: {float(cny) if cny else 0:.5f}")
    print(f"   GBP: {float(gbp) if gbp else 0:.4f}")
    print(f"   RUB: {float(rub) if rub else 0:.6f}")
    print(f"   TRY: {float(try_rate) if try_rate else 0:.4f}")
    print(f"   AED: {float(aed) if aed else 0:.5f}")
    print(f"   KZT: {float(kzt) if kzt else 0:.4f}")

cursor.close()
conn.close()
