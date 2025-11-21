#!/usr/bin/env python3
"""Analyze counteragents - find new ones after 9/1/2025"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

print("=" * 100)
print("COUNTERAGENTS ANALYSIS - New Records After 9/1/2025")
print("=" * 100)

# Read Excel
df = pd.read_excel('DICT_USERS.xlsx', sheet_name='Counteragents')
print(f"\n📊 Total counteragents in Excel: {len(df)}")

# Filter by date
cutoff_date = datetime(2025, 9, 1)
df['Timestamp'] = pd.to_datetime(df['Timestamp'])
new_counteragents = df[df['Timestamp'] >= cutoff_date]

print(f"📅 Counteragents registered after 9/1/2025: {len(new_counteragents)}")

if len(new_counteragents) == 0:
    print("\n✓ No new counteragents found after 9/1/2025")
    exit(0)

print(f"\nDate range in new records: {new_counteragents['Timestamp'].min()} to {new_counteragents['Timestamp'].max()}")

# Get existing UUIDs from database
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT counteragent_uuid FROM counteragents")
db_uuids = set(row[0] for row in cur.fetchall())
print(f"\n💾 Counteragents in database: {len(db_uuids)}")

# Check which new ones are missing
new_uuids = set()
missing_counteragents = []

for idx, row in new_counteragents.iterrows():
    uuid_val = row['კონტრაგენტი_GUID/']
    if pd.notna(uuid_val):
        uuid_str = str(uuid_val).strip().lower()
        new_uuids.add(uuid_str)
        
        if uuid_str not in db_uuids:
            missing_counteragents.append({
                'uuid': uuid_str,
                'name': row['დასახელება/სახელი :'] if pd.notna(row['დასახელება/სახელი :']) else 'N/A',
                'tax_id': row['საიდენტიფიკაციო კოდი :'] if pd.notna(row['საიდენტიფიკაციო კოდი :']) else 'N/A',
                'timestamp': row['Timestamp'],
                'entity_type': row['სამართლებრივი ფორმა :'] if pd.notna(row['სამართლებრივი ფორმა :']) else 'N/A'
            })

print(f"🆕 Unique new counteragent UUIDs: {len(new_uuids)}")
print(f"❌ Missing from database: {len(missing_counteragents)}")

if missing_counteragents:
    print("\n" + "=" * 100)
    print("MISSING COUNTERAGENTS (Registered after 9/1/2025):")
    print("=" * 100)
    
    for i, ca in enumerate(missing_counteragents, 1):
        print(f"\n{i}. {ca['name']}")
        print(f"   UUID: {ca['uuid']}")
        print(f"   Tax ID: {ca['tax_id']}")
        print(f"   Entity Type: {ca['entity_type']}")
        print(f"   Registered: {ca['timestamp']}")
    
    # Export to CSV
    missing_df = pd.DataFrame(missing_counteragents)
    missing_df.to_csv('missing_counteragents_after_sept2025.csv', index=False)
    print(f"\n💾 Exported to: missing_counteragents_after_sept2025.csv")
else:
    print("\n✓ All new counteragents (after 9/1/2025) are already in the database!")

# Summary statistics
print("\n" + "=" * 100)
print("SUMMARY:")
print("=" * 100)
print(f"  Excel total: {len(df)}")
print(f"  Registered after 9/1/2025: {len(new_counteragents)}")
print(f"  Unique UUIDs in new records: {len(new_uuids)}")
print(f"  Already in database: {len(new_uuids) - len(missing_counteragents)}")
print(f"  Missing from database: {len(missing_counteragents)}")

cur.close()
conn.close()

print("\n" + "=" * 100)
