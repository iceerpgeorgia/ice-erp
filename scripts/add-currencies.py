import psycopg2
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

# Currencies to add
new_currencies = [
    {'code': 'GBP', 'name': 'British Pound'},
    {'code': 'RUB', 'name': 'Russian Ruble'},
    {'code': 'TRY', 'name': 'Turkish Lira'},
    {'code': 'AED', 'name': 'UAE Dirham'},
    {'code': 'KZT', 'name': 'Kazakhstani Tenge'}
]

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("📋 Adding new currencies to LOCAL database...")
    print("=" * 80)
    
    added = 0
    skipped = 0
    
    for currency in new_currencies:
        code = currency['code']
        name = currency['name']
        
        # Check if currency already exists
        cur.execute("SELECT code FROM currencies WHERE code = %s;", (code,))
        exists = cur.fetchone()
        
        if exists:
            print(f"⏭️  {code} - Already exists, skipping")
            skipped += 1
        else:
            cur.execute("""
                INSERT INTO currencies (code, name, is_active)
                VALUES (%s, %s, true)
                RETURNING id, uuid, code, name;
            """, (code, name))
            result = cur.fetchone()
            print(f"✅ {code} - Added: {name} (id: {result[0]}, uuid: {result[1]})")
            added += 1
    
    conn.commit()
    
    print("\n" + "=" * 80)
    print(f"✅ Added: {added} currencies")
    print(f"⏭️  Skipped: {skipped} (already exist)")
    
    # Show all currencies now
    print("\n📊 ALL CURRENCIES IN DATABASE:")
    print("=" * 80)
    cur.execute("""
        SELECT id, code, name, is_active, created_at
        FROM currencies
        ORDER BY id;
    """)
    all_currencies = cur.fetchall()
    
    print(f"{'ID':<5} {'Code':<8} {'Name':<25} {'Active':<8} {'Created'}")
    print("-" * 80)
    for curr in all_currencies:
        curr_id, code, name, is_active, created_at = curr
        active_str = "✓" if is_active else "✗"
        created_str = created_at.strftime("%Y-%m-%d") if created_at else ""
        print(f"{curr_id:<5} {code:<8} {name:<25} {active_str:<8} {created_str}")
    
    print(f"\n📈 Total: {len(all_currencies)} currencies")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
