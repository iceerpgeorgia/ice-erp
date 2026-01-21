#!/usr/bin/env python3
"""
Regenerate salary_accruals template without insurance_limit
"""
import pandas as pd
import os
from datetime import datetime

# Create templates directory
templates_dir = 'templates'
os.makedirs(templates_dir, exist_ok=True)

# Define fields for salary_accruals (without insurance_limit)
fields = [
    'uuid',
    'counteragent_uuid',
    'financial_code_uuid',
    'nominal_currency_uuid',
    'payment_id',
    'salary_month',
    'net_sum',
    'total_insurance',
    'deducted_insurance',
    'deducted_fitness',
    'deducted_fine',
    'created_by',
    'updated_by'
]

# Generate 3 sample rows
data = {
    'uuid': ['550e8400-e29b-41d4-a716-446655440000'] * 3,
    'counteragent_uuid': ['550e8400-e29b-41d4-a716-446655440000'] * 3,
    'financial_code_uuid': ['550e8400-e29b-41d4-a716-446655440000'] * 3,
    'nominal_currency_uuid': ['550e8400-e29b-41d4-a716-446655440000'] * 3,
    'payment_id': ['PAY001', 'PAY002', 'PAY003'],
    'salary_month': [datetime.now().strftime('%Y-%m-01')] * 3,
    'net_sum': [1000.00, 2000.00, 3000.00],
    'total_insurance': [100.00, 200.00, 300.00],
    'deducted_insurance': [50.00, 100.00, 150.00],
    'deducted_fitness': [25.00, 50.00, 75.00],
    'deducted_fine': [0.00, 0.00, 0.00],
    'created_by': ['admin@example.com'] * 3,
    'updated_by': ['admin@example.com'] * 3
}

# Create DataFrame
df = pd.DataFrame(data)

# Save to Excel
filename = 'salary_accruals_import_template_new.xlsx'
filepath = os.path.join(templates_dir, filename)

try:
    df.to_excel(filepath, index=False, sheet_name='salary_accruals')
    print(f'✅ Created: {filepath}')
    print(f'📊 Columns: {len(df.columns)}')
    print(f'📝 Sample rows: {len(df)}')
    print(f'\n🔍 Columns included:')
    for col in df.columns:
        print(f'   • {col}')
except Exception as e:
    print(f'❌ Error: {e}')
