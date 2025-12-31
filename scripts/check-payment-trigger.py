#!/usr/bin/env python3
"""Check if payment trigger is properly installed and working"""

import os
import sys
import psycopg2

# Get DATABASE_URL from environment (should already be set)
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    print("   Please set it first: $env:DATABASE_URL='your_connection_string'")
    sys.exit(1)

try:
    print("🔌 Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Check if trigger function exists
    print("\n1️⃣ Checking trigger function 'generate_payment_id'...")
    cur.execute("""
        SELECT EXISTS(
            SELECT 1 FROM pg_proc 
            WHERE proname = 'generate_payment_id'
        )
    """)
    function_exists = cur.fetchone()[0]
    
    if function_exists:
        print("   ✅ Function 'generate_payment_id' exists")
    else:
        print("   ❌ Function 'generate_payment_id' NOT FOUND")
    
    # Check if trigger is attached to payments table
    print("\n2️⃣ Checking trigger on 'payments' table...")
    cur.execute("""
        SELECT tgname, tgtype, tgenabled 
        FROM pg_trigger 
        WHERE tgrelid = 'payments'::regclass 
        AND tgname LIKE '%payment_id%'
    """)
    triggers = cur.fetchall()
    
    if triggers:
        print(f"   ✅ Found {len(triggers)} trigger(s):")
        for tgname, tgtype, tgenabled in triggers:
            status = "ENABLED" if tgenabled == 'O' else "DISABLED"
            print(f"      - {tgname} ({status})")
    else:
        print("   ❌ No payment_id trigger found on payments table")
    
    # Test if auto-generation works by checking recent payments
    print("\n3️⃣ Checking recent payments for auto-generated IDs...")
    cur.execute("""
        SELECT id, payment_id, record_uuid, created_at 
        FROM payments 
        ORDER BY id DESC 
        LIMIT 5
    """)
    recent_payments = cur.fetchall()
    
    if recent_payments:
        print(f"   📊 Last 5 payments:")
        for pid, payment_id, record_uuid, created_at in recent_payments:
            payment_id_status = "✅" if payment_id else "❌ EMPTY"
            record_uuid_status = "✅" if record_uuid else "❌ EMPTY"
            print(f"      ID {pid}: payment_id={payment_id or 'NULL'} {payment_id_status}, record_uuid={record_uuid or 'NULL'} {record_uuid_status}")
    else:
        print("   ℹ️ No payments found in table")
    
    # Check for payment #4226 specifically
    print("\n4️⃣ Checking payment #4226...")
    cur.execute("""
        SELECT id, payment_id, record_uuid 
        FROM payments 
        WHERE id = 4226
    """)
    payment_4226 = cur.fetchone()
    
    if payment_4226:
        pid, payment_id, record_uuid = payment_4226
        print(f"   Payment #{pid}:")
        print(f"      payment_id: {payment_id or '❌ NULL/EMPTY'}")
        print(f"      record_uuid: {record_uuid or '❌ NULL/EMPTY'}")
        
        if not payment_id or not record_uuid:
            print("\n   ⚠️ Payment #4226 has missing IDs - trigger was not active when it was created")
    else:
        print("   ❌ Payment #4226 not found")
    
    cur.close()
    conn.close()
    
    print("\n" + "="*60)
    if not function_exists or not triggers:
        print("❌ TRIGGER NOT PROPERLY INSTALLED")
        print("   Run: pwsh scripts/apply-payment-trigger.ps1")
    else:
        print("✅ TRIGGER IS INSTALLED AND ACTIVE")
        print("   New payments will auto-generate payment_id and record_uuid")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)
