# Calculations Module - Documentation

## Overview
The Calculations Module provides a system for linking financial code templates with calculation templates. It enables users to manage which calculation templates apply to which financial codes.

## Database Schema

### Table: `calculations_financial_codes`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Internal auto-increment ID |
| uuid | UUID | UNIQUE, DEFAULT gen_random_uuid() | Public identifier |
| financial_code_uuid | UUID | FK → financial_codes.uuid | Reference to financial code |
| template_uuid | UUID | FK → templates.uuid | Reference to template |
| template_name | VARCHAR(255) | NOT NULL | Display name of the template |
| is_active | BOOLEAN | DEFAULT true | Status flag |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

### Constraints
- **Unique**: `uq_calc_fc_template` on (financial_code_uuid, template_uuid)
- **Foreign Keys**:
  - financial_code_uuid → financial_codes.uuid (CASCADE DELETE)
  - template_uuid → templates.uuid (CASCADE DELETE)

### Indexes
- `idx_calculations_fc_uuid` on financial_code_uuid
- `idx_calculations_template_uuid` on template_uuid
- `idx_calculations_is_active` on is_active

## API Endpoints

### GET /api/calculations-financial-codes
List all calculation templates with optional filtering.

**Query Parameters:**
- `financial_code_uuid` (string, optional) - Filter by financial code
- `template_uuid` (string, optional) - Filter by template
- `is_active` (boolean, optional) - Filter by active status
- `limit` (number, default: 100) - Results per page
- `offset` (number, default: 0) - Pagination offset

**Response:**
```json
{
  "data": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "financial_code_uuid": "uuid-1",
      "template_uuid": "uuid-2",
      "template_name": "Monthly Payroll Template",
      "is_active": true,
      "created_at": "2026-07-07T10:00:00Z",
      "financial_code": {
        "uuid": "uuid-1",
        "code": "4010",
        "name": "Salary Expenses"
      },
      "template": {
        "uuid": "uuid-2",
        "operation_type": "payroll",
        "file_name": "payroll_template.xlsx"
      }
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

### POST /api/calculations-financial-codes
Create a new calculation template.

**Request Body:**
```json
{
  "financial_code_uuid": "uuid-1",
  "template_uuid": "uuid-2",
  "template_name": "Monthly Payroll Template",
  "is_active": true
}
```

**Response:** 201 Created - Returns the created calculation template

**Errors:**
- 400: Missing required fields
- 404: Financial code or template not found
- 409: Duplicate calculation template already exists
- 500: Server error

### GET /api/calculations-financial-codes/[uuid]
Get a specific calculation template by UUID.

**Response:** 200 OK - Returns the calculation template

**Errors:**
- 404: Calculation not found
- 500: Server error

### PUT /api/calculations-financial-codes/[uuid]
Update a calculation template.

**Request Body:**
```json
{
  "template_name": "Updated Name",
  "is_active": false
}
```

**Response:** 200 OK - Returns updated calculation template

**Errors:**
- 404: Calculation not found
- 500: Server error

### DELETE /api/calculations-financial-codes/[uuid]
Delete a calculation template.

**Response:** 200 OK - Confirmation message

**Errors:**
- 404: Calculation not found
- 500: Server error

## UI Components

### Main Page: `/app/calculations/page.tsx`

**Features:**
- **List View**: Table displaying all calculation templates with:
  - Financial Code (code + name)
  - Template (operation type)
  - Template Name
  - Active status indicator
  - Creation date
  - Edit/Delete action buttons

- **Create/Edit Form** with:
  - Financial Code dropdown
  - Template dropdown
  - Template name input
  - Active status checkbox
  - Save/Cancel buttons

- **Error Handling**: Display error messages for failed operations

- **Responsive Design**: Mobile-friendly table layout

## Usage Guide

### Creating a Calculation Template

1. Navigate to `/calculations`
2. Click "Add Template" button
3. Select a Financial Code from the dropdown
4. Select a Template from the dropdown
5. Enter the Template Name
6. Toggle Active status if needed
7. Click "Create"

### Editing a Calculation Template

1. Click the Edit icon (pencil) on any calculation template row
2. Modify the template name or active status
3. Click "Update" to save changes

### Deleting a Calculation Template

1. Click the Delete icon (trash) on any calculation template row
2. Confirm the deletion in the popup dialog
3. The template will be removed

## Prisma Integration

### Models
The following models are used:
- `calculations_financial_codes` - Main calculation template model
- `financial_codes` - Referenced financial codes
- `templates` - Referenced templates

### Relations
```prisma
model calculations_financial_codes {
  // ... fields
  financial_code   financial_codes  @relation(fields: [financial_code_uuid], references: [uuid], onDelete: Cascade)
  template         templates        @relation(fields: [template_uuid], references: [uuid], onDelete: Cascade)
}

model financial_codes {
  // ... fields
  calculations     calculations_financial_codes[]
}

model templates {
  // ... fields
  calculations     calculations_financial_codes[]
}
```

## Error Handling

The API includes comprehensive error handling:

| Status | Scenario | Action |
|--------|----------|--------|
| 200 | Success | Return data |
| 201 | Resource created | Return created resource |
| 400 | Invalid input | Return validation error |
| 404 | Resource not found | Return 404 error |
| 409 | Duplicate record | Return conflict error |
| 500 | Server error | Log and return error |

## Future Enhancements

1. **Bulk Operations**
   - Bulk create/update/delete calculations
   - Import from CSV/Excel
   - Export calculations data

2. **Advanced Filtering**
   - Search by template name
   - Filter by date range
   - Multi-select filters

3. **Audit Trail**
   - Track who created/modified calculations
   - Version history
   - Restore previous versions

4. **Calculation Logic**
   - Define calculation formulas per template
   - Validate calculation inputs
   - Execute calculations and track results

5. **Permissions**
   - Role-based access control
   - User/team-based calculation templates
   - Approval workflows

6. **Integration**
   - Link calculations to actual payment processing
   - Automatic calculation execution on payment events
   - Results export and reporting

## Migration Details

**Migration File**: `20260707170830_add_calculations_financial_codes_table`

**Location**: `prisma/migrations/20260707170830_add_calculations_financial_codes_table/migration.sql`

**Changes**:
- Created `calculations_financial_codes` table
- Added 5 indexes for optimal query performance
- Established foreign key relationships with cascade deletes
- Added unique constraint on (financial_code_uuid, template_uuid) pair

## Testing

### Manual API Testing

```bash
# List all calculations
curl http://localhost:3000/api/calculations-financial-codes

# Create a new calculation
curl -X POST http://localhost:3000/api/calculations-financial-codes \
  -H "Content-Type: application/json" \
  -d '{
    "financial_code_uuid": "your-fc-uuid",
    "template_uuid": "your-template-uuid",
    "template_name": "Test Template",
    "is_active": true
  }'

# Get specific calculation
curl http://localhost:3000/api/calculations-financial-codes/your-uuid

# Update calculation
curl -X PUT http://localhost:3000/api/calculations-financial-codes/your-uuid \
  -H "Content-Type: application/json" \
  -d '{"template_name": "Updated Name", "is_active": false}'

# Delete calculation
curl -X DELETE http://localhost:3000/api/calculations-financial-codes/your-uuid
```

### UI Testing

1. Navigate to `/calculations` in the browser
2. Verify calculations list loads
3. Test creating a new calculation template
4. Test editing an existing template
5. Test deleting a template
6. Verify error messages display correctly

## Database Performance

### Query Optimization

1. **Indexes**: All frequently filtered columns are indexed
2. **Foreign Keys**: Properly set up with cascade deletes
3. **Unique Constraints**: Prevent duplicate calculations
4. **Pagination**: Implemented with limit/offset for large datasets

### Expected Performance

- List query with 1000 records: < 100ms
- Create calculation: < 50ms
- Update calculation: < 50ms
- Delete calculation: < 50ms

## Summary

The Calculations Module provides a complete system for managing calculation templates linked to financial codes. It includes a database layer, REST API, and user-friendly interface for full CRUD operations with proper validation and error handling.
