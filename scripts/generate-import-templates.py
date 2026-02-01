#!/usr/bin/env python3
"""Generate Excel import templates for all dictionaries"""

import pandas as pd
import os
from datetime import datetime

# Create templates directory if it doesn't exist
templates_dir = 'templates'
os.makedirs(templates_dir, exist_ok=True)

def create_countries_template():
    """Create Countries dictionary template"""
    df = pd.DataFrame({
        'code': ['GE', 'US', 'UK'],
        'name_ka': ['საქართველო', 'ამერიკის შეერთებული შტატები', 'გაერთიანებული სამეფო'],
        'name_en': ['Georgia', 'United States', 'United Kingdom'],
        'name_ru': ['Грузия', 'Соединенные Штаты', 'Великобритания'],
        'is_active': [True, True, True],
        'sort_order': [1, 2, 3],
        'notes': ['Example country 1', 'Example country 2', 'Example country 3']
    })
    
    filepath = os.path.join(templates_dir, 'countries_import_template.xlsx')
    df.to_excel(filepath, index=False, sheet_name='Countries')
    print(f"✓ Created: {filepath}")
    return filepath

def create_entity_types_template():
    """Create Entity Types dictionary template"""
    df = pd.DataFrame({
        'name_ka': ['შეზღუდული პასუხისმგებლობის საზოგადოება', 'სააქციო საზოგადოება', 'კოოპერატივი'],
        'name_en': ['Limited Liability Company', 'Joint Stock Company', 'Cooperative'],
        'name_ru': ['Общество с ограниченной ответственностью', 'Акционерное общество', 'Кооператив'],
        'is_active': [True, True, True],
        'sort_order': [1, 2, 3],
        'notes': ['Most common entity type', 'Public company', 'Cooperative organization']
    })
    
    filepath = os.path.join(templates_dir, 'entity_types_import_template.xlsx')
    df.to_excel(filepath, index=False, sheet_name='Entity Types')
    print(f"✓ Created: {filepath}")
    return filepath

def create_counteragents_template():
    """Create Counteragents dictionary template"""
    df = pd.DataFrame({
        'code': ['CA001', 'CA002', 'CA003'],
        'name_ka': ['კონტრაგენტი 1', 'კონტრაგენტი 2', 'კონტრაგენტი 3'],
        'name_en': ['Counteragent 1', 'Counteragent 2', 'Counteragent 3'],
        'legal_name': ['Legal Name 1 LLC', 'Legal Name 2 JSC', 'Legal Name 3 COOP'],
        'tax_id': ['123456789', '987654321', '555666777'],
        'entity_type_uuid': ['<uuid1>', '<uuid2>', '<uuid3>'],
        'country_code': ['GE', 'US', 'UK'],
        'address': ['123 Main St, Tbilisi', '456 Oak Ave, New York', '789 King Rd, London'],
        'email': ['contact1@example.com', 'contact2@example.com', 'contact3@example.com'],
        'phone': ['+995 32 2 123456', '+1 212 5551234', '+44 20 71234567'],
        'contact_person': ['John Doe', 'Jane Smith', 'Bob Johnson'],
        'bank_name': ['Bank of Georgia', 'Chase Bank', 'Barclays'],
        'bank_account': ['GE12BG1234567890123456', 'US12345678901234567890', 'GB12BARC12345678901234'],
        'is_customer': [True, False, True],
        'is_supplier': [False, True, True],
        'is_active': [True, True, True],
        'credit_limit': [10000.00, 50000.00, 25000.00],
        'payment_terms_days': [30, 60, 45],
        'notes': ['Important customer', 'Main supplier', 'Both customer and supplier']
    })
    
    filepath = os.path.join(templates_dir, 'counteragents_import_template.xlsx')
    df.to_excel(filepath, index=False, sheet_name='Counteragents')
    print(f"✓ Created: {filepath}")
    return filepath

def create_financial_codes_template():
    """Create Financial Codes dictionary template"""
    df = pd.DataFrame({
        'code': ['1', '1.1', '1.1.1', '2', '2.1'],
        'name': [
            'შემოსავლები რეალიზაციიდან',
            'შემოსავალი ლიფტების რეალიზაციიდან',
            'შემოსავალი ლიფტების რეალიზაციიდან - ავანსი',
            'ხარჯები',
            'ხარჯები - ფიქსირებული'
        ],
        'parent_code': [None, '1', '1.1', None, '2'],
        'is_income': [True, True, True, False, False],
        'applies_to_pl': [True, True, True, True, True],
        'applies_to_cf': [True, True, True, False, False],
        'is_active': [True, True, True, True, True],
        'description': [
            'Income from sales',
            'Income from elevator sales',
            'Advance payment for elevators',
            'Expenses',
            'Fixed expenses'
        ]
    })
    
    filepath = os.path.join(templates_dir, 'financial_codes_import_template.xlsx')
    df.to_excel(filepath, index=False, sheet_name='Financial Codes')
    print(f"✓ Created: {filepath}")
    return filepath

def create_readme():
    """Create README with instructions"""
    readme_content = """# Dictionary Import Templates

This folder contains Excel templates for importing data into the system dictionaries.

## Generated: {}

## Available Templates

### 1. Countries (`countries_import_template.xlsx`)
**Required columns:**
- `code`: 2-letter country code (ISO 3166-1 alpha-2)
- `name_ka`: Country name in Georgian
- `name_en`: Country name in English
- `name_ru`: Country name in Russian
- `is_active`: Boolean (TRUE/FALSE)
- `sort_order`: Integer for sorting
- `notes`: Optional notes

**Import command:**
```bash
python scripts/import-countries.py
```

### 2. Entity Types (`entity_types_import_template.xlsx`)
**Required columns:**
- `name_ka`: Entity type name in Georgian
- `name_en`: Entity type name in English
- `name_ru`: Entity type name in Russian
- `is_active`: Boolean (TRUE/FALSE)
- `sort_order`: Integer for sorting
- `notes`: Optional notes

**Import command:**
```bash
python scripts/import-entity-types.py
```

### 3. Counteragents (`counteragents_import_template.xlsx`)
**Required columns:**
- `code`: Unique counteragent code
- `name_ka`: Name in Georgian
- `name_en`: Name in English
- `legal_name`: Legal entity name
- `tax_id`: Tax identification number
- `entity_type_uuid`: Reference to entity type (must exist)
- `country_code`: Reference to country (must exist)
- `is_customer`: Boolean (TRUE/FALSE)
- `is_supplier`: Boolean (TRUE/FALSE)
- `is_active`: Boolean (TRUE/FALSE)

**Optional columns:**
- `address`, `email`, `phone`, `contact_person`
- `bank_name`, `bank_account`
- `credit_limit`, `payment_terms_days`
- `notes`

**Import command:**
```bash
python scripts/import-counteragents.py
```

### 4. Financial Codes (`financial_codes_import_template.xlsx`)
**Required columns:**
- `code`: Hierarchical code (e.g., "1.1.1")
- `name`: Financial code name
- `is_income`: Boolean (TRUE/FALSE)
- `applies_to_pl`: Applies to P&L (TRUE/FALSE)
- `applies_to_cf`: Applies to Cash Flow (TRUE/FALSE)
- `is_active`: Boolean (TRUE/FALSE)

**Optional columns:**
- `parent_code`: Parent code for hierarchy
- `description`: Optional description

**Import command:**
```bash
python scripts/import-from-xlsx.py
```

## General Notes

1. **Excel Format**: All templates are in `.xlsx` format
2. **Boolean Values**: Use TRUE/FALSE (Excel boolean format)
3. **Dates**: Use Excel date format
4. **Empty Values**: Leave cells empty for NULL values
5. **Code Uniqueness**: All `code` columns must contain unique values
6. **References**: Foreign key references (entity_type_uuid, country_code) must exist in respective tables

## Import Process

1. Download the template you need
2. Fill in your data following the column requirements
3. Save the file (keep the same filename or rename as needed)
4. Place the file in the project root directory
5. Run the corresponding import command
6. Check the import logs for any errors

## Validation Rules

- **Countries**: Code must be 2 characters, unique
- **Counteragents**: Code must be unique, must reference valid entity_type and country
- **Financial Codes**: Hierarchical codes must follow pattern (numbers separated by dots)

## Error Handling

- Duplicate codes will be rejected
- Invalid references will be reported
- Required fields cannot be empty
- The import process will show detailed error messages

## Backup Recommendation

**Always backup your database before running imports:**
```bash
pg_dump -U postgres -d ICE_ERP > backup_$(date +%Y%m%d_%H%M%S).sql
```

---
*Generated automatically by `scripts/generate-import-templates.py`*
""".format(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    
    filepath = os.path.join(templates_dir, 'README.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print(f"✓ Created: {filepath}")
    return filepath

def main():
    print("=" * 80)
    print("Generating Dictionary Import Templates")
    print("=" * 80)
    print()
    
    # Create all templates
    templates = []
    templates.append(create_countries_template())
    templates.append(create_entity_types_template())
    templates.append(create_counteragents_template())
    templates.append(create_financial_codes_template())
    templates.append(create_readme())
    
    print()
    print("=" * 80)
    print(f"✓ Successfully created {len(templates)} files in '{templates_dir}/' folder")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Navigate to the 'templates/' folder")
    print("  2. Open any template in Excel")
    print("  3. Fill in your data")
    print("  4. Save and run the corresponding import script")
    print()
    print("See templates/README.md for detailed instructions.")
    print()

if __name__ == '__main__':
    main()
