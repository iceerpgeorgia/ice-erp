import psycopg2
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

# Currency name updates
currency_names = {
    'USD': 'US Dollar',
    'GEL': 'Georgian Lari',
    'EUR': 'Euro',
    'CNY': 'Chinese Yuan'
}

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("📝 Updating currency names in LOCAL database...")
    print("=" * 80)
    
    updated = 0
    
    for code, name in currency_names.items():
        cur.execute("""
            UPDATE currencies 
            SET name = %s, updated_at = CURRENT_TIMESTAMP
            WHERE code = %s
            RETURNING id, code, name;
        """, (name, code))
        
        result = cur.fetchone()
        if result:
            print(f"✅ {code} → {name}")
            updated += 1
        else:
            print(f"⚠️  {code} - Not found in database")
    
    conn.commit()
    
    print("\n" + "=" * 80)
    print(f"✅ Updated: {updated} currencies")
    
    # Show all currencies now
    print("\n📊 ALL CURRENCIES IN DATABASE:")
    print("=" * 80)
    cur.execute("""
        SELECT id, code, name, is_active, created_at
        FROM currencies
        ORDER BY id;
    """)
    all_currencies = cur.fetchall()
    
    print(f"{'ID':<5} {'Code':<8} {'Name':<30} {'Active':<8} {'Created'}")
    print("-" * 80)
    for curr in all_currencies:
        curr_id, code, name, is_active, created_at = curr
        active_str = "✓" if is_active else "✗"
        created_str = created_at.strftime("%Y-%m-%d") if created_at else ""
        print(f"{curr_id:<5} {code:<8} {name:<30} {active_str:<8} {created_str}")
    
    print(f"\n📈 Total: {len(all_currencies)} currencies")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
