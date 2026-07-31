#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DIRECT_URL'))
cur = conn.cursor()

project_uuid = '2496a0e0-1118-49dc-8a82-539003dc1b23'

# Get project
cur.execute("SELECT project_uuid, project_name, value FROM projects WHERE project_uuid = %s", (project_uuid,))
project = cur.fetchone()
print(f"Project: {project}")

if project:
    # Get payments for this project
    cur.execute("""
        SELECT payment_id, counteragent_uuid, financial_code_uuid, is_active 
        FROM payments 
        WHERE project_uuid = %s
    """, (project_uuid,))
    payments = cur.fetchall()
    print(f"\nPayments for this project: {len(payments)}")
    for pmt in payments:
        print(f"  payment_id={pmt[0]}, counteragent={pmt[1]}, fc={pmt[2]}, is_active={pmt[3]}")
        
        # Get adjustments for this payment
        cur.execute("""
            SELECT id, amount, nominal_amount, is_deleted 
            FROM payment_adjustments 
            WHERE payment_id = %s
        """, (pmt[0],))
        adjs = cur.fetchall()
        print(f"    Adjustments: {len(adjs)}")
        for adj in adjs:
            print(f"      id={adj[0]}, amount={adj[1]}, nominal_amount={adj[2]}, is_deleted={adj[3]}")

cur.close()
conn.close()
