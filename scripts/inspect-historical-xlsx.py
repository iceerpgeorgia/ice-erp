#!/usr/bin/env python3
"""Inspect Historical NBG Excel files."""

import os
import pandas as pd
from datetime import datetime

historical_folder = "Historical NBG"

print("📁 Inspecting Historical NBG Excel files...")
print()

# Check each xlsx file
for filename in sorted(os.listdir(historical_folder)):
    if not filename.endswith('.xlsx'):
        continue
    
    filepath = os.path.join(historical_folder, filename)
    
    try:
        # Read the Excel file
        df = pd.read_excel(filepath)
        
        print(f"📄 {filename}")
        print(f"   Columns: {list(df.columns)}")
        print(f"   Rows: {len(df)}")
        
        # Show first few rows
        if len(df) > 0:
            print(f"   First row data:")
            for col in df.columns:
                print(f"      {col}: {df[col].iloc[0]}")
        
        # Check if there's a Date column
        date_cols = [col for col in df.columns if 'date' in col.lower() or 'თარიღ' in col.lower()]
        if date_cols:
            print(f"   Date column: {date_cols[0]}")
            # Show date range
            dates = pd.to_datetime(df[date_cols[0]], errors='coerce')
            valid_dates = dates.dropna()
            if len(valid_dates) > 0:
                print(f"   Date range: {valid_dates.min()} to {valid_dates.max()}")
        
        print()
    
    except Exception as e:
        print(f"   ❌ Error reading {filename}: {e}")
        print()
