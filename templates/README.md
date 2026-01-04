# Dictionary Import Templates

This folder contains Excel templates for importing data into the system.

**Auto-generated:** 2026-01-05 00:22:39

## Available Templates


### Country (`country_import_template.xlsx`)

**Required columns:**
- `ts`: DateTime
- `country_uuid`: String
- `name_en`: String
- `name_ka`: String
- `iso2`: String
- `iso3`: String
- `is_active`: Boolean (TRUE/FALSE)

**Optional columns:**
- `un_code`: Int
- `country`: String

### Counteragent (`counteragent_import_template.xlsx`)

**Required columns:**
- `ts`: DateTime
- `counteragent_uuid`: String
- `is_emploee`: Boolean (TRUE/FALSE)
- `is_active`: Boolean (TRUE/FALSE)
- `was_emploee`: Boolean (TRUE/FALSE)

**Optional columns:**
- `name`: String
- `identification_number`: String
- `birth_or_incorporation_date`: DateTime
- `sex`: String
- `address_line_1`: String
- `address_line_2`: String
- `zip_code`: String
- `iban`: String
- `swift`: String
- `director`: String
- `director_id`: String
- `email`: String
- `phone`: String
- `oris_id`: String
- `country_uuid`: String
- `entity_type_uuid`: String
- `entity_type`: String
- `country`: String
- `counteragent`: String
- `internal_number`: String
- `pension_scheme`: Boolean (TRUE/FALSE)

### EntityType (`entitytype_import_template.xlsx`)

**Required columns:**
- `ts`: DateTime
- `entity_type_uuid`: String
- `code`: String
- `name_en`: String
- `name_ka`: String
- `is_active`: Boolean (TRUE/FALSE)

### Entry (`entry_import_template.xlsx`)

**Required columns:**
- `userId`: String
- `project`: String
- `hours`: Int

### AuditLog (`auditlog_import_template.xlsx`)

**Required columns:**
- `table`: String
- `recordId`: String
- `action`: String

**Optional columns:**
- `userEmail`: String
- `userId`: String
- `changes`: Json

### FinancialCode (`financialcode_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `code`: String
- `name`: String
- `appliesToPL`: Boolean (TRUE/FALSE)
- `appliesToCF`: Boolean (TRUE/FALSE)
- `isIncome`: Boolean (TRUE/FALSE)
- `depth`: Int
- `sortOrder`: Int
- `isActive`: Boolean (TRUE/FALSE)

**Optional columns:**
- `validation`: String
- `parentUuid`: String
- `description`: String

### Transaction (`transaction_import_template.xlsx`)

**Required columns:**
- `date`: DateTime
- `amount`: Decimal
- `description`: String
- `financialCodeId`: BigInt

**Optional columns:**
- `counteragentId`: BigInt
- `createdBy`: String
- `updatedBy`: String

### Project (`project_import_template.xlsx`)

**Required columns:**
- `projectUuid`: String
- `counteragentUuid`: String
- `financialCodeUuid`: String
- `currencyUuid`: String
- `stateUuid`: String
- `projectName`: String
- `date`: DateTime
- `value`: Decimal

**Optional columns:**
- `oris1630`: String
- `counteragent`: String
- `financialCode`: String
- `currency`: String
- `state`: String
- `contractNo`: String
- `projectIndex`: String

### ProjectEmployee (`projectemployee_import_template.xlsx`)

**Required columns:**
- `projectId`: BigInt
- `employeeUuid`: String
- `isActive`: Boolean (TRUE/FALSE)
- `assignedAt`: DateTime

**Optional columns:**
- `employeeName`: String

### Currency (`currency_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `code`: String
- `name`: String
- `isActive`: Boolean (TRUE/FALSE)

### Bank (`bank_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `bankName`: String
- `isActive`: Boolean (TRUE/FALSE)

### BankAccount (`bankaccount_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `accountNumber`: String
- `currencyUuid`: String
- `isActive`: Boolean (TRUE/FALSE)

**Optional columns:**
- `bankUuid`: String

### ConsolidatedBankAccount (`consolidatedbankaccount_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `accountUuid`: String
- `accountCurrencyUuid`: String
- `accountCurrencyAmount`: Decimal
- `date`: DateTime
- `recordUuid`: String

**Optional columns:**
- `paymentUuid`: String
- `counteragentUuid`: String
- `projectUuid`: String
- `financialCodeUuid`: String
- `nominalCurrencyUuid`: String
- `nominalAmount`: Decimal
- `correctionDate`: DateTime
- `id1`: String
- `id2`: String
- `counteragentAccountNumber`: String
- `description`: String

### NBGExchangeRate (`nbgexchangerate_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `date`: DateTime

**Optional columns:**
- `usdRate`: Decimal
- `eurRate`: Decimal
- `cnyRate`: Decimal
- `gbpRate`: Decimal
- `rubRate`: Decimal
- `tryRate`: Decimal
- `aedRate`: Decimal
- `kztRate`: Decimal

### DocumentType (`documenttype_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `isActive`: Boolean (TRUE/FALSE)

### ProjectState (`projectstate_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `isActive`: Boolean (TRUE/FALSE)

### MIDimension (`midimension_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `isActive`: Boolean (TRUE/FALSE)

### Brand (`brand_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `counteragentUuids`: String
- `isActive`: Boolean (TRUE/FALSE)

### Job (`job_import_template.xlsx`)

**Required columns:**
- `jobUuid`: String
- `projectUuid`: String
- `jobName`: String
- `isFf`: Boolean (TRUE/FALSE)
- `isActive`: Boolean (TRUE/FALSE)

**Optional columns:**
- `floors`: Int
- `weight`: Int
- `brandUuid`: String

### Payment (`payment_import_template.xlsx`)

**Required columns:**
- `counteragentUuid`: String
- `financialCodeUuid`: String
- `incomeTax`: Boolean (TRUE/FALSE)
- `currencyUuid`: String
- `paymentId`: String
- `recordUuid`: String
- `isActive`: Boolean (TRUE/FALSE)

**Optional columns:**
- `projectUuid`: String
- `jobUuid`: String

### PaymentLedger (`paymentledger_import_template.xlsx`)

**Required columns:**
- `paymentId`: String
- `effectiveDate`: DateTime
- `recordUuid`: String
- `userEmail`: String

**Optional columns:**
- `accrual`: Decimal
- `order`: Decimal
- `comment`: String


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
