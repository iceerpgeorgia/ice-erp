#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DIRECT_URL'))
cur = conn.cursor()

project_uuid = '2496a0e0-1118-49dc-8a82-539003dc1b23'

# Get project
cur.execute("SELECT project_uuid, project_name, payment_id, value FROM projects WHERE project_uuid = %s", (project_uuid,))
project = cur.fetchone()
print(f"Project: {project}")

if project:
    project_payment_id = project[2]
    print(f"\nProject payment_id: {project_payment_id}")
    
    # Get adjustments for this payment_id
    if project_payment_id:
        cur.execute("""
            SELECT id, payment_id, amount, nominal_amount, is_deleted 
            FROM payment_adjustments 
            WHERE payment_id = %s
        """, (project_payment_id,))
        adjustments = cur.fetchall()
        print(f"\nAdjustments for this payment_id: {len(adjustments)} found")
        for adj in adjustments:
            print(f"  {adj}")
    
    # Get all adjustments (sample)
    cur.execute("""
        SELECT id, payment_id, amount, nominal_amount, is_deleted 
        FROM payment_adjustments 
        WHERE is_deleted = false
        LIMIT 5
    """)
    all_adj = cur.fetchall()
    print(f"\nAll non-deleted adjustments (sample): {len(all_adj)} found")
    for adj in all_adj:
        print(f"  {adj}")

cur.close()
conn.close()
