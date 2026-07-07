# Calculations Module - Quick Start Guide

## 🚀 Quick Setup

The Calculations Module has been successfully created with the following components:

### ✅ Database
- **Table**: `calculations_financial_codes`
- **Migration**: Applied and migrated
- **Relations**: Properly configured with foreign keys

### ✅ API Endpoints
- `GET /api/calculations-financial-codes` - List all
- `POST /api/calculations-financial-codes` - Create new
- `GET /api/calculations-financial-codes/[uuid]` - Get one
- `PUT /api/calculations-financial-codes/[uuid]` - Update
- `DELETE /api/calculations-financial-codes/[uuid]` - Delete

### ✅ User Interface
- **URL**: `/calculations`
- **Features**: Full CRUD operations with modern UI

---

## 📝 Table Structure

```sql
CREATE TABLE calculations_financial_codes (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),
  financial_code_uuid UUID NOT NULL,
  template_uuid UUID NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (financial_code_uuid) REFERENCES financial_codes(uuid) ON DELETE CASCADE,
  FOREIGN KEY (template_uuid) REFERENCES templates(uuid) ON DELETE CASCADE,
  UNIQUE (financial_code_uuid, template_uuid)
);
```

---

## 🔗 Column Reference

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | UUID | Unique identifier (public) |
| `financial_code_uuid` | UUID | Links to financial code |
| `template_uuid` | UUID | Links to template |
| `template_name` | TEXT | Template display name |
| `is_active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## 🌐 API Examples

### Get All Calculations
```bash
curl http://localhost:3000/api/calculations-financial-codes?limit=50&offset=0
```

### Create Calculation
```bash
curl -X POST http://localhost:3000/api/calculations-financial-codes \
  -H "Content-Type: application/json" \
  -d '{
    "financial_code_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "template_uuid": "660f9411-f30c-52e5-b827-557766551111",
    "template_name": "Payroll Template",
    "is_active": true
  }'
```

### Update Calculation
```bash
curl -X PUT http://localhost:3000/api/calculations-financial-codes/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"template_name": "Updated Name", "is_active": false}'
```

### Delete Calculation
```bash
curl -X DELETE http://localhost:3000/api/calculations-financial-codes/550e8400-e29b-41d4-a716-446655440000
```

---

## 🎯 Next Steps

1. **View UI**: Navigate to `http://localhost:3000/calculations`
2. **Add First Template**: Click "Add Template" button
3. **Select Financial Code**: Choose from the dropdown
4. **Select Template**: Choose calculation template
5. **Save**: Click "Create"

---

## 📚 Files Created

```
app/
├── api/
│   └── calculations-financial-codes/
│       ├── route.ts (GET/POST)
│       └── [uuid]/
│           └── route.ts (GET/PUT/DELETE)
└── calculations/
    └── page.tsx (UI)

prisma/
├── schema.prisma (updated)
└── migrations/
    └── 20260707170830_add_calculations_financial_codes_table/
        └── migration.sql

Documentation:
├── CALCULATIONS_MODULE.md (full documentation)
└── CALCULATIONS_MODULE_QUICKSTART.md (this file)
```

---

## ⚙️ Prisma Schema

```prisma
model calculations_financial_codes {
  id                   BigInt            @id @default(autoincrement())
  uuid                 String            @unique @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  financial_code_uuid  String            @db.Uuid
  template_uuid        String            @db.Uuid
  template_name        String            @db.VarChar(255)
  is_active            Boolean           @default(true)
  created_at           DateTime          @default(now())
  updated_at           DateTime          @default(now()) @updatedAt
  
  financial_code       financial_codes?  @relation(fields: [financial_code_uuid], references: [uuid], onDelete: Cascade)
  template             templates?        @relation(fields: [template_uuid], references: [uuid], onDelete: Cascade)

  @@unique([financial_code_uuid, template_uuid], map: "uq_calc_fc_template")
  @@index([financial_code_uuid], map: "idx_calculations_fc_uuid")
  @@index([template_uuid], map: "idx_calculations_template_uuid")
  @@index([is_active], map: "idx_calculations_is_active")
  @@map("calculations_financial_codes")
}
```

---

## 🔍 Verify Installation

Run these commands to verify everything is working:

```bash
# Check if table exists
psql -c "SELECT * FROM calculations_financial_codes LIMIT 0;"

# Check schema
psql -c "\d calculations_financial_codes"

# Test API
curl http://localhost:3000/api/calculations-financial-codes
```

---

## ⚡ Performance Features

- ✅ Indexed queries for fast lookups
- ✅ Cascade deletes to maintain referential integrity
- ✅ Pagination support for large datasets
- ✅ Unique constraint to prevent duplicates
- ✅ Optimized database structure

---

## 🐛 Troubleshooting

### Table not found error
```bash
# Regenerate Prisma client
pnpm prisma generate

# Check migrations
pnpm prisma migrate status
```

### Foreign key constraint errors
- Ensure financial_code_uuid exists in financial_codes table
- Ensure template_uuid exists in templates table

### API not responding
```bash
# Check if Next.js server is running
npm run dev

# Verify API route is registered
curl -X OPTIONS http://localhost:3000/api/calculations-financial-codes -v
```

---

## 📞 Support

For detailed information, see:
- [Full Documentation](./CALCULATIONS_MODULE.md)
- [API Reference](./CALCULATIONS_MODULE.md#api-endpoints)
- [Database Schema](./CALCULATIONS_MODULE.md#database-schema)

---

**Created**: 2026-07-07
**Status**: ✅ Ready for use
