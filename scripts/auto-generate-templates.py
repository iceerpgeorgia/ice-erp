#!/usr/bin/env python3
"""
Auto-generate Excel import templates from Prisma schema
Scans prisma/schema.prisma and creates templates for all tables
"""

import pandas as pd
import os
import re
from datetime import datetime

# Create templates directory
templates_dir = 'templates'
os.makedirs(templates_dir, exist_ok=True)

def parse_prisma_schema(schema_path='prisma/schema.prisma'):
    """Parse Prisma schema and extract model definitions"""
    with open(schema_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    models = {}
    # Find all model blocks
    model_pattern = r'model\s+(\w+)\s*\{([^}]+)\}'
    
    for match in re.finditer(model_pattern, content, re.MULTILINE):
        model_name = match.group(1)
        model_body = match.group(2)
        
        # Skip internal NextAuth models
        if model_name in ['Account', 'Session', 'User', 'VerificationToken']:
            continue
        
        fields = []
        # Parse fields
        field_pattern = r'(\w+)\s+(String|Int|BigInt|Boolean|DateTime|Decimal|Float|Json)(\?)?'
        
        for field_match in re.finditer(field_pattern, model_body):
            field_name = field_match.group(1)
            field_type = field_match.group(2)
            is_optional = field_match.group(3) == '?'
            
            # Skip auto-generated fields
            if field_name in ['id', 'createdAt', 'created_at', 'updatedAt', 'updated_at']:
                continue
            
            # Skip relation fields (they usually have @relation)
            if '@relation' in model_body.split(field_name)[1].split('\n')[0]:
                continue
            
            fields.append({
                'name': field_name,
                'type': field_type,
                'optional': is_optional
            })
        
        if fields:
            models[model_name] = fields
    
    return models

def get_sample_value(field_name, field_type):
    """Generate sample values based on field name and type"""
    field_lower = field_name.lower()
    
    # Boolean fields
    if field_type == 'Boolean':
        if 'active' in field_lower:
            return True
        return False if 'not' in field_lower or 'disable' in field_lower else True
    
    # Numeric fields
    if field_type in ['Int', 'BigInt']:
        if 'order' in field_lower or 'sort' in field_lower:
            return 1
        if 'amount' in field_lower or 'price' in field_lower:
            return 1000
        if 'quantity' in field_lower or 'count' in field_lower:
            return 10
        return 1
    
    if field_type in ['Decimal', 'Float']:
        if 'rate' in field_lower or 'percent' in field_lower:
            return 5.5
        if 'amount' in field_lower or 'price' in field_lower or 'total' in field_lower:
            return 1000.00
        return 0.0
    
    # String fields
    if field_type == 'String':
        if 'code' in field_lower:
            return 'CODE001'
        if 'name' in field_lower:
            if 'ka' in field_lower:
                return 'სახელი'
            if 'en' in field_lower:
                return 'Name'
            if 'ru' in field_lower:
                return 'Название'
            return 'Sample Name'
        if 'email' in field_lower:
            return 'example@example.com'
        if 'phone' in field_lower:
            return '+995 32 2 123456'
        if 'address' in field_lower:
            return '123 Main Street'
        if 'description' in field_lower or 'note' in field_lower:
            return 'Sample description'
        if 'url' in field_lower or 'link' in field_lower:
            return 'https://example.com'
        if 'uuid' in field_lower:
            return '550e8400-e29b-41d4-a716-446655440000'
        return 'Sample Text'
    
    # DateTime fields
    if field_type == 'DateTime':
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    return 'Sample'

def create_template_for_model(model_name, fields):
    """Create Excel template for a specific model"""
    # Create filename
    filename = f"{model_name.lower()}_import_template.xlsx"
    filepath = os.path.join(templates_dir, filename)
    
    # Check if template already exists and skip if it does
    if os.path.exists(filepath):
        return None, model_name, fields
    
    # Generate 3 sample rows
    data = {}
    for field in fields:
        column_name = field['name']
        sample_values = []
        
        for i in range(3):
            value = get_sample_value(field['name'], field['type'])
            
            # Modify sample values to make them unique
            if field['type'] == 'String' and 'code' in field['name'].lower():
                value = f"{value[:-1]}{i+1}"
            elif field['type'] == 'String' and 'name' in field['name'].lower():
                value = f"{value} {i+1}"
            elif field['type'] in ['Int', 'BigInt']:
                if 'order' in field['name'].lower() or 'sort' in field['name'].lower():
                    value = i + 1
                else:
                    value = value * (i + 1)
            
            sample_values.append(value)
        
        data[column_name] = sample_values
    
    df = pd.DataFrame(data)
    
    # Convert snake_case to Title Case for sheet name
    sheet_name = model_name.replace('_', ' ').title()
    if len(sheet_name) > 31:  # Excel sheet name limit
        sheet_name = sheet_name[:31]
    
    df.to_excel(filepath, index=False, sheet_name=sheet_name)
    return filepath, model_name, fields

def generate_model_documentation(model_name, fields):
    """Generate documentation section for a model"""
    doc = f"\n### {model_name} (`{model_name.lower()}_import_template.xlsx`)\n\n"
    doc += "**Required columns:**\n"
    
    required_fields = [f for f in fields if not f['optional']]
    for field in required_fields:
        doc += f"- `{field['name']}`: {field['type']}"
        if field['type'] == 'Boolean':
            doc += " (TRUE/FALSE)"
        doc += "\n"
    
    optional_fields = [f for f in fields if f['optional']]
    if optional_fields:
        doc += "\n**Optional columns:**\n"
        for field in optional_fields:
            doc += f"- `{field['name']}`: {field['type']}"
            if field['type'] == 'Boolean':
                doc += " (TRUE/FALSE)"
            doc += "\n"
    
    return doc

def update_readme(models_info):
    """Update README with all model documentation"""
    readme_content = f"""# Dictionary Import Templates

This folder contains Excel templates for importing data into the system.

**Auto-generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Available Templates

"""
    
    # Add documentation for each model
    for idx, (model_name, fields) in enumerate(models_info.items(), 1):
        readme_content += generate_model_documentation(model_name, fields)
    
    readme_content += """

## General Guidelines

### Data Types

- **String**: Text values (use quotes if needed in Excel)
- **Int/BigInt**: Whole numbers
- **Decimal/Float**: Decimal numbers (use . as decimal separator)
- **Boolean**: TRUE or FALSE (Excel boolean)
- **DateTime**: Use Excel date/time format (YYYY-MM-DD HH:MM:SS)
- **Json**: Valid JSON string

### Important Rules

1. **Unique Codes**: All `code` columns must contain unique values
2. **Required Fields**: Cannot be empty (marked as required)
3. **Boolean Values**: Use TRUE/FALSE (not Yes/No, 1/0)
4. **References**: Foreign key columns (xxx_uuid, xxx_code) must reference existing records
5. **Dates**: Use consistent date format throughout
6. **Null Values**: Leave cells empty for NULL (don't write "NULL" or "null")

### Import Process

1. Download the appropriate template
2. Fill in your data following the column requirements
3. Save the file (keep .xlsx format)
4. Place file in project root or specify path
5. Run the import script:
   ```bash
   python scripts/import-<table-name>.py
   ```

### Validation

Before import, the script will check:
- Required fields are not empty
- Unique constraints are satisfied
- Foreign key references exist
- Data types are correct
- No duplicate codes

### Error Handling

If import fails:
- Check error messages in console
- Verify all required fields are filled
- Ensure codes are unique
- Validate foreign key references
- Check data type formats

### Backup Before Import

**Always backup your database first:**
```bash
# PostgreSQL backup
pg_dump -U postgres -d ICE_ERP > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use Prisma Studio to export data
pnpm prisma studio
```

### Re-generating Templates

To regenerate templates after schema changes:
```bash
python scripts/auto-generate-templates.py
```

This will:
- Scan prisma/schema.prisma
- Create templates for all models
- Update this README
- Preserve your existing data files

---

*Auto-generated by `scripts/auto-generate-templates.py`*  
*Do not edit this file manually - it will be overwritten*
"""
    
    filepath = os.path.join(templates_dir, 'README.md')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    return filepath

def main():
    print("=" * 80)
    print("Auto-Generating Import Templates from Prisma Schema")
    print("=" * 80)
    print()
    
    # Parse schema
    print("📖 Reading prisma/schema.prisma...")
    models = parse_prisma_schema()
    print(f"✓ Found {len(models)} models to process\n")
    
    if not models:
        print("⚠️  No models found in schema (or all were excluded)")
        return
    
    # Generate templates
    print("📝 Generating templates...")
    created_files = []
    skipped_files = []
    models_info = {}
    
    for model_name, fields in models.items():
        filepath, name, flds = create_template_for_model(model_name, fields)
        models_info[name] = flds
        
        if filepath:
            created_files.append(filepath)
            print(f"  ✓ {model_name}: {filepath}")
        else:
            skipped_files.append(f"{model_name.lower()}_import_template.xlsx")
            print(f"  ⊙ {model_name}: already exists, skipped")
    
    # Update README
    print("\n📄 Updating README.md...")
    readme_path = update_readme(models_info)
    created_files.append(readme_path)
    print(f"  ✓ {readme_path}")
    
    print()
    print("=" * 80)
    if created_files:
        print(f"✓ Created {len(created_files)} new template(s)")
    if skipped_files:
        print(f"⊙ Skipped {len(skipped_files)} existing template(s)")
    print(f"📁 Total files in '{templates_dir}/': {len(created_files) + len(skipped_files) + 1}")  # +1 for README
    print("=" * 80)
    print()
    print("Models processed:")
    for model_name in models_info.keys():
        print(f"  • {model_name}")
    print()
    if created_files:
        print("💡 New templates are ready to use!")
    if skipped_files:
        print("💡 Existing templates were preserved (delete manually to regenerate)")
    print()
    print("🔄 Run this script again after updating prisma/schema.prisma")
    print("   to auto-generate templates for new tables.")
    print()

if __name__ == '__main__':
    main()
