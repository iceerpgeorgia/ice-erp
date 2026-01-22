"""
Export skipped transactions (those without valid DocValueDate) to Excel
Includes ALL fields from the XML/database
"""
import psycopg2
import pandas as pd
from datetime import datetime

# Connect to Supabase
url = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'

print("Connecting to Supabase...")
conn = psycopg2.connect(url, connect_timeout=10)
cur = conn.cursor()

print("Fetching skipped transactions with all fields...")

# Query ALL fields from records with NULL or empty DocValueDate
query = '''
    SELECT *
    FROM bog_gel_raw_893486000 
    WHERE DocValueDate IS NULL OR TRIM(DocValueDate) = ''
    ORDER BY DocRecDate DESC
'''

cur.execute(query)
records = cur.fetchall()

# Get column names from cursor description
columns = [desc[0] for desc in cur.description]

print(f"Found {len(records)} records with {len(columns)} fields each")

# Create DataFrame directly from records
df = pd.DataFrame(records, columns=columns)

# Convert any problematic column types for Excel
# Convert UUID and datetime objects to strings
for col in df.columns:
    if df[col].dtype == 'object':
        df[col] = df[col].astype(str)

# Export to Excel
filename = f'skipped_transactions_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
print(f"\nExporting to {filename}...")

with pd.ExcelWriter(filename, engine='openpyxl') as writer:
    df.to_excel(writer, index=False, sheet_name='Skipped Transactions')
    
    # Auto-adjust column widths (limited to first 26 columns due to Excel limitations)
    worksheet = writer.sheets['Skipped Transactions']
    for idx, col in enumerate(df.columns[:26]):  # Limit to A-Z
        try:
            max_length = max(
                df[col].astype(str).apply(len).max(),
                len(col)
            )
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)
        except:
            pass

print(f"✅ Exported {len(records)} skipped transactions to: {filename}")
print("\nSummary:")
print(f"  - Total skipped: {len(records)}")
print(f"  - Reason: Missing or empty DocValueDate (transaction date)")
print(f"  - These records are in raw table but excluded from consolidated")
print(f"\nOpen {filename} to review these transactions")

conn.close()
