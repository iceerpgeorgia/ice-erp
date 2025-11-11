#!/usr/bin/env python3
"""
Validate NBG Exchange Rates System
Comprehensive health check for the entire NBG rates system.
"""

import os
import psycopg2
from datetime import datetime, timedelta

def get_database_connection():
    """Get database connection."""
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP")
    database_url = database_url.split('?')[0]
    return psycopg2.connect(database_url)

def check_table_exists():
    """Check if nbg_exchange_rates table exists."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'nbg_exchange_rates'
        );
    """)
    
    exists = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    
    return exists

def check_data_statistics():
    """Get basic statistics about the data."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    # Total records
    cursor.execute("SELECT COUNT(*) FROM nbg_exchange_rates")
    total_records = cursor.fetchone()[0]
    
    # Date range
    cursor.execute("SELECT MIN(date), MAX(date) FROM nbg_exchange_rates")
    min_date, max_date = cursor.fetchone()
    
    # Check for nulls
    cursor.execute("""
        SELECT 
            COUNT(*) FILTER (WHERE usd_rate IS NULL) as usd_nulls,
            COUNT(*) FILTER (WHERE eur_rate IS NULL) as eur_nulls,
            COUNT(*) FILTER (WHERE gbp_rate IS NULL) as gbp_nulls,
            COUNT(*) FILTER (WHERE rub_rate IS NULL) as rub_nulls
        FROM nbg_exchange_rates
    """)
    
    null_counts = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    return {
        'total_records': total_records,
        'min_date': min_date,
        'max_date': max_date,
        'null_counts': {
            'usd': null_counts[0],
            'eur': null_counts[1],
            'gbp': null_counts[2],
            'rub': null_counts[3]
        }
    }

def check_recent_updates():
    """Check if recent data is up to date."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    # Get most recent date
    cursor.execute("SELECT MAX(date) FROM nbg_exchange_rates")
    latest_date = cursor.fetchone()[0]
    
    today = datetime.now().date()
    days_behind = (today - latest_date).days
    
    cursor.close()
    conn.close()
    
    return {
        'latest_date': latest_date,
        'today': today,
        'days_behind': days_behind
    }

def check_currency_synchronization():
    """Check if all active currencies have corresponding columns."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    # Get active currencies
    cursor.execute("""
        SELECT code FROM currencies 
        WHERE is_active = true AND code != 'GEL'
        ORDER BY code
    """)
    active_currencies = [row[0] for row in cursor.fetchall()]
    
    # Get existing columns
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'nbg_exchange_rates' 
        AND column_name LIKE '%_rate'
    """)
    existing_columns = {row[0].replace('_rate', '').upper() for row in cursor.fetchall()}
    
    cursor.close()
    conn.close()
    
    missing = [c for c in active_currencies if c not in existing_columns]
    
    return {
        'active_currencies': active_currencies,
        'columns_count': len(existing_columns),
        'missing': missing,
        'in_sync': len(missing) == 0
    }

def check_data_gaps():
    """Check for missing dates in the last 30 days."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    # Check last 30 days for gaps
    cursor.execute("""
        SELECT date::date
        FROM generate_series(
            CURRENT_DATE - INTERVAL '30 days',
            CURRENT_DATE,
            '1 day'
        ) AS date
        WHERE date NOT IN (
            SELECT date FROM nbg_exchange_rates
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        )
        ORDER BY date;
    """)
    
    missing_dates = [row[0] for row in cursor.fetchall()]
    
    cursor.close()
    conn.close()
    
    return missing_dates

def check_rate_sanity():
    """Check if rates are within reasonable ranges."""
    conn = get_database_connection()
    cursor = conn.cursor()
    
    # Get latest rates
    cursor.execute("""
        SELECT usd_rate, eur_rate, gbp_rate, rub_rate
        FROM nbg_exchange_rates
        ORDER BY date DESC
        LIMIT 1
    """)
    
    rates = cursor.fetchone()
    cursor.close()
    conn.close()
    
    issues = []
    
    # USD should be between 2 and 4 GEL
    if rates[0] and (float(rates[0]) < 2 or float(rates[0]) > 4):
        issues.append(f"USD rate unusual: {rates[0]}")
    
    # EUR should be between 2.5 and 5 GEL
    if rates[1] and (float(rates[1]) < 2.5 or float(rates[1]) > 5):
        issues.append(f"EUR rate unusual: {rates[1]}")
    
    # GBP should be between 3 and 6 GEL
    if rates[2] and (float(rates[2]) < 3 or float(rates[2]) > 6):
        issues.append(f"GBP rate unusual: {rates[2]}")
    
    # RUB should be between 0.01 and 0.1 GEL
    if rates[3] and (float(rates[3]) < 0.01 or float(rates[3]) > 0.1):
        issues.append(f"RUB rate unusual: {rates[3]}")
    
    return {
        'rates': {
            'usd': float(rates[0]) if rates[0] else None,
            'eur': float(rates[1]) if rates[1] else None,
            'gbp': float(rates[2]) if rates[2] else None,
            'rub': float(rates[3]) if rates[3] else None,
        },
        'issues': issues
    }

def validate_system():
    """Run comprehensive system validation."""
    print("=" * 70)
    print("NBG Exchange Rates System - Health Check")
    print("=" * 70)
    print(f"🕐 Validation Time: {datetime.now()}\n")
    
    # 1. Check table exists
    print("1️⃣  Checking table existence...")
    if check_table_exists():
        print("   ✅ Table 'nbg_exchange_rates' exists\n")
    else:
        print("   ❌ Table 'nbg_exchange_rates' NOT FOUND!\n")
        print("   💡 Run: python scripts/create-nbg-rates-table.py\n")
        return False
    
    # 2. Check data statistics
    print("2️⃣  Checking data statistics...")
    stats = check_data_statistics()
    print(f"   📊 Total records: {stats['total_records']:,}")
    print(f"   📅 Date range: {stats['min_date']} to {stats['max_date']}")
    
    if stats['total_records'] == 0:
        print("   ⚠️  No data in table!")
        print("   💡 Run: python scripts/import-nbg-historical-rates.py\n")
    else:
        print("   ✅ Data present")
        
        # Check for excessive nulls
        total = stats['total_records']
        null_threshold = total * 0.1  # 10% threshold
        
        issues = []
        for currency, null_count in stats['null_counts'].items():
            if null_count > null_threshold:
                issues.append(f"{currency.upper()}: {null_count} nulls")
        
        if issues:
            print(f"   ⚠️  High null counts: {', '.join(issues)}")
        else:
            print("   ✅ Null counts acceptable\n")
    
    # 3. Check recent updates
    print("3️⃣  Checking recent updates...")
    recent = check_recent_updates()
    print(f"   📅 Latest date: {recent['latest_date']}")
    print(f"   📅 Today: {recent['today']}")
    print(f"   📊 Days behind: {recent['days_behind']}")
    
    if recent['days_behind'] == 0:
        print("   ✅ Data is up to date!\n")
    elif recent['days_behind'] <= 3:
        print("   ⚠️  Data is slightly behind (likely weekend/holiday)\n")
    else:
        print(f"   ❌ Data is {recent['days_behind']} days behind!")
        print("   💡 Run: python scripts/update-nbg-rates.py\n")
    
    # 4. Check currency synchronization
    print("4️⃣  Checking currency synchronization...")
    sync = check_currency_synchronization()
    print(f"   💱 Active currencies: {len(sync['active_currencies'])} ({', '.join(sync['active_currencies'])})")
    print(f"   📊 Rate columns: {sync['columns_count']}")
    
    if sync['in_sync']:
        print("   ✅ All currencies have corresponding columns\n")
    else:
        print(f"   ❌ Missing columns for: {', '.join(sync['missing'])}")
        print("   💡 Run: python scripts/sync-currency-columns.py\n")
    
    # 5. Check for data gaps
    print("5️⃣  Checking for data gaps (last 30 days)...")
    gaps = check_data_gaps()
    
    if not gaps:
        print("   ✅ No gaps in last 30 days\n")
    else:
        print(f"   ⚠️  {len(gaps)} missing dates:")
        for date in gaps[:5]:  # Show first 5
            print(f"      - {date}")
        if len(gaps) > 5:
            print(f"      ... and {len(gaps) - 5} more")
        print()
    
    # 6. Check rate sanity
    print("6️⃣  Checking rate sanity...")
    sanity = check_rate_sanity()
    print("   💵 Latest rates:")
    for currency, rate in sanity['rates'].items():
        if rate:
            print(f"      {currency.upper()}: 1 = {rate:.6f} GEL")
    
    if sanity['issues']:
        print(f"   ⚠️  Unusual rates detected:")
        for issue in sanity['issues']:
            print(f"      - {issue}")
        print()
    else:
        print("   ✅ All rates within expected ranges\n")
    
    # Final summary
    print("=" * 70)
    print("📋 Summary")
    print("=" * 70)
    
    all_good = (
        stats['total_records'] > 0 and
        recent['days_behind'] <= 3 and
        sync['in_sync'] and
        not sanity['issues']
    )
    
    if all_good:
        print("✅ System is healthy and operational!")
        print("\n💡 Recommended actions:")
        print("   - Schedule daily updates: python scripts/update-nbg-rates.py")
        print("   - Monitor logs for failures")
        print("   - Review rates weekly for accuracy")
    else:
        print("⚠️  System needs attention!")
        print("\n💡 Recommended actions:")
        if stats['total_records'] == 0:
            print("   - Import historical data: python scripts/import-nbg-historical-rates.py")
        if recent['days_behind'] > 3:
            print("   - Update rates: python scripts/update-nbg-rates.py")
        if not sync['in_sync']:
            print("   - Sync currency columns: python scripts/sync-currency-columns.py")
    
    print("=" * 70)

if __name__ == "__main__":
    try:
        validate_system()
    except Exception as e:
        print(f"\n❌ Validation failed with error: {e}")
        import traceback
        traceback.print_exc()
