import os
import psycopg2
from datetime import datetime, timedelta

# Get database URL from environment
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print("❌ DATABASE_URL not set")
    exit(1)

# Remove pgbouncer parameter if present (not supported by psycopg2)
if '?pgbouncer=' in db_url:
    db_url = db_url.split('?pgbouncer=')[0]

# Connect to database
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Check last 5 dates in database
print("📊 Last 5 dates in nbg_exchange_rates table:")
print("=" * 80)
cur.execute("""
    SELECT DISTINCT date 
    FROM nbg_exchange_rates 
    ORDER BY date DESC 
    LIMIT 5
""")
dates = cur.fetchall()
for row in dates:
    print(f"  {row[0]}")

print("\n" + "=" * 80)

# Check if today's date exists
today = datetime.now().date()
print(f"\n🔍 Checking for today's date: {today}")
cur.execute("""
    SELECT COUNT(*) 
    FROM nbg_exchange_rates 
    WHERE date = %s
""", (today,))
count = cur.fetchone()[0]
print(f"   Records found: {count}")

if count == 0:
    print("   ❌ Today's rates NOT found in database")
else:
    print("   ✅ Today's rates exist in database")
    # Show the rates
    cur.execute("""
        SELECT currency, rate 
        FROM nbg_exchange_rates 
        WHERE date = %s
        ORDER BY currency
    """, (today,))
    rates = cur.fetchall()
    print("\n   Today's rates:")
    for currency, rate in rates:
        print(f"     {currency}: {rate}")

print("\n" + "=" * 80)

# Check the gap between last date and today
print(f"\n📅 Gap analysis:")
cur.execute("""
    SELECT MAX(date) 
    FROM nbg_exchange_rates
""")
last_date = cur.fetchone()[0]
print(f"   Last date in DB: {last_date}")
print(f"   Today's date: {today}")

if last_date:
    gap_days = (today - last_date).days
    print(f"   Gap: {gap_days} days")
    
    if gap_days > 0:
        print(f"\n   ⚠️  Missing {gap_days} day(s) of data")
        print(f"   Cron should have filled dates from {last_date + timedelta(days=1)} to {today}")
    else:
        print(f"\n   ✅ Database is up to date")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("\n💡 Cron job info:")
print("   Schedule: 0 19 * * * (19:00 UTC = 23:00 Georgian time)")
print("   Current time (UTC): " + datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
print("   Current time (Local): " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
print("\n   If it's before 23:00 Georgian time, cron hasn't run yet today.")
