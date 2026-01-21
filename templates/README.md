# Dictionary Import Templates

This folder contains Excel templates for importing data into the system.

**Auto-generated:** 2026-01-20 01:11:14

## Available Templates


### AuditLog (`auditlog_import_template.xlsx`)

**Required columns:**
- `table`: String
- `record_id`: String
- `action`: String

**Optional columns:**
- `user_email`: String
- `user_id`: String
- `changes`: Json

### Entry (`entry_import_template.xlsx`)

**Required columns:**
- `userId`: String
- `project`: String
- `hours`: Int

### BankAccount (`bankaccount_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `accountNumber`: String
- `currencyUuid`: String
- `isActive`: Boolean (TRUE/FALSE)

**Optional columns:**
- `bankUuid`: String
- `balance`: Decimal
- `balanceDate`: DateTime
- `parsingSchemeUuid`: String
- `rawTableName`: String
- `parsingSchemeId`: BigInt

### Bank (`bank_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `bankName`: String
- `isActive`: Boolean (TRUE/FALSE)

### bog_gel_raw_893486000 (`bog_gel_raw_893486000_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `import_date`: DateTime
- `is_processed`: Boolean (TRUE/FALSE)

**Optional columns:**
- `cancopydocument`: String
- `canviewdocument`: String
- `canprintdocument`: String
- `isreval`: String
- `docnomination`: String
- `docinformation`: String
- `docsrcamt`: String
- `docsrcccy`: String
- `docdstamt`: String
- `docdstccy`: String
- `dockey`: String
- `docrecdate`: String
- `docbranch`: String
- `docdepartment`: String
- `docprodgroup`: String
- `docno`: String
- `docvaluedate`: String
- `docsendername`: String
- `docsenderinn`: String
- `docsenderacctno`: String
- `docsenderbic`: String
- `docactualdate`: String
- `doccoracct`: String
- `doccorbic`: String
- `doccorbankname`: String
- `entriesid`: String
- `doccomment`: String
- `ccyrate`: String
- `entrypdate`: String
- `entrydocno`: String
- `entrylacct`: String
- `entrylacctold`: String
- `entrydbamt`: String
- `entrydbamtbase`: String
- `entrycramt`: String
- `entrycramtbase`: String
- `outbalance`: String
- `entryamtbase`: String
- `entrycomment`: String
- `entrydepartment`: String
- `entryacctpoint`: String
- `docsenderbicname`: String
- `docbenefname`: String
- `docbenefinn`: String
- `docbenefacctno`: String
- `docbenefbic`: String
- `docbenefbicname`: String
- `docpayername`: String
- `docpayerinn`: String
- `import_batch_id`: String
- `counteragent_processed`: Boolean (TRUE/FALSE)
- `counteragent_inn_blank`: Boolean (TRUE/FALSE)
- `parsing_rule_dominance`: Boolean (TRUE/FALSE)
- `parsing_rule_processed`: Boolean (TRUE/FALSE)
- `payment_id_processed`: Boolean (TRUE/FALSE)
- `counteragent_inn`: String
- `processing_case`: String
- `counteragent_found`: Boolean (TRUE/FALSE)
- `counteragent_missing`: Boolean (TRUE/FALSE)
- `payment_id_matched`: Boolean (TRUE/FALSE)
- `payment_id_conflict`: Boolean (TRUE/FALSE)
- `parsing_rule_applied`: Boolean (TRUE/FALSE)
- `parsing_rule_conflict`: Boolean (TRUE/FALSE)
- `applied_rule_id`: Int

### brands (`brands_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `counteragent_uuids`: String
- `is_active`: Boolean (TRUE/FALSE)

### ConsolidatedBankAccount (`consolidatedbankaccount_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `bankAccountUuid`: String
- `rawRecordUuid`: String
- `transactionDate`: String
- `accountCurrencyUuid`: String
- `accountCurrencyAmount`: Decimal
- `nominalCurrencyUuid`: String
- `nominalAmount`: Decimal

**Optional columns:**
- `description`: String
- `counteragentUuid`: String
- `projectUuid`: String
- `financialCodeUuid`: String
- `processingCase`: String
- `counteragentAccountNumber`: String
- `paymentId`: String
- `correctionDate`: DateTime
- `exchangeRate`: Decimal

### counteragents (`counteragents_import_template.xlsx`)

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

### countries (`countries_import_template.xlsx`)

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

### currencies (`currencies_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `code`: String
- `name`: String
- `is_active`: Boolean (TRUE/FALSE)

### document_types (`document_types_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `is_active`: Boolean (TRUE/FALSE)

### entity_types (`entity_types_import_template.xlsx`)

**Required columns:**
- `ts`: DateTime
- `entity_type_uuid`: String
- `code`: String
- `name_en`: String
- `name_ka`: String
- `is_active`: Boolean (TRUE/FALSE)

### financial_codes (`financial_codes_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `code`: String
- `name`: String
- `applies_to_pl`: Boolean (TRUE/FALSE)
- `applies_to_cf`: Boolean (TRUE/FALSE)
- `is_income`: Boolean (TRUE/FALSE)
- `depth`: Int
- `sort_order`: Int
- `is_active`: Boolean (TRUE/FALSE)

**Optional columns:**
- `validation`: String
- `parent_uuid`: String
- `description`: String

### jobs (`jobs_import_template.xlsx`)

**Required columns:**
- `job_uuid`: String
- `project_uuid`: String
- `job_name`: String
- `is_ff`: Boolean (TRUE/FALSE)
- `is_active`: Boolean (TRUE/FALSE)

**Optional columns:**
- `floors`: Int
- `weight`: Int
- `brand_uuid`: String

### mi_dimensions (`mi_dimensions_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `is_active`: Boolean (TRUE/FALSE)

### nbg_exchange_rates (`nbg_exchange_rates_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `date`: DateTime

**Optional columns:**
- `usd_rate`: Decimal
- `eur_rate`: Decimal
- `cny_rate`: Decimal
- `gbp_rate`: Decimal
- `rub_rate`: Decimal
- `try_rate`: Decimal
- `aed_rate`: Decimal
- `kzt_rate`: Decimal

### parsing_scheme_rules (`parsing_scheme_rules_import_template.xlsx`)

**Required columns:**
- `scheme_uuid`: String
- `condition`: String

**Optional columns:**
- `column_name`: String
- `payment_id`: String
- `condition_script`: String
- `counteragent_uuid`: String
- `financial_code_uuid`: String
- `nominal_currency_uuid`: String
- `active`: Boolean (TRUE/FALSE)

### parsing_schemes (`parsing_schemes_import_template.xlsx`)

**Required columns:**
- `scheme`: String
- `uuid`: String

### payments (`payments_import_template.xlsx`)

**Required columns:**
- `counteragent_uuid`: String
- `financial_code_uuid`: String
- `payment_id`: String
- `record_uuid`: String
- `is_active`: Boolean (TRUE/FALSE)
- `income_tax`: Boolean (TRUE/FALSE)
- `currency_uuid`: String

**Optional columns:**
- `project_uuid`: String
- `job_uuid`: String

### payments_ledger (`payments_ledger_import_template.xlsx`)

**Required columns:**
- `payment_id`: String
- `effective_date`: DateTime
- `record_uuid`: String
- `user_email`: String

**Optional columns:**
- `accrual`: Decimal
- `order`: Decimal
- `comment`: String

### project_employees (`project_employees_import_template.xlsx`)

**Required columns:**
- `project_id`: BigInt
- `employee_uuid`: String
- `isActive`: Boolean (TRUE/FALSE)
- `assignedAt`: DateTime

**Optional columns:**
- `employee_name`: String

### project_states (`project_states_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `name`: String
- `is_active`: Boolean (TRUE/FALSE)

### projects (`projects_import_template.xlsx`)

**Required columns:**
- `project_uuid`: String
- `counteragent_uuid`: String
- `financial_code_uuid`: String
- `currency_uuid`: String
- `state_uuid`: String
- `project_name`: String
- `date`: DateTime
- `value`: Decimal

**Optional columns:**
- `oris_1630`: String
- `counteragent`: String
- `financial_code`: String
- `currency`: String
- `state`: String
- `contract_no`: String
- `project_index`: String

### transactions (`transactions_import_template.xlsx`)

**Required columns:**
- `date`: DateTime
- `amount`: Decimal
- `description`: String
- `financial_code_id`: BigInt

**Optional columns:**
- `counteragent_id`: BigInt
- `created_by`: String
- `updated_by`: String

### salary_accruals (`salary_accruals_import_template.xlsx`)

**Required columns:**
- `uuid`: String
- `counteragent_uuid`: String
- `financial_code_uuid`: String
- `nominal_currency_uuid`: String
- `payment_id`: String
- `salary_month`: DateTime
- `net_sum`: Decimal
- `created_by`: String
- `updated_by`: String

**Optional columns:**
- `surplus_insurance`: Decimal
- `deducted_insurance`: Decimal
- `deducted_fitness`: Decimal
- `deducted_fine`: Decimal


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
