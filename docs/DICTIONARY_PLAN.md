# Dictionary Implementation Plan

## Priority 1: Core Reference Tables (Simple - Flat Table Design)
These are independent dictionaries with no foreign keys:

1. **Currencies** (4 rows)
   - columns: name, code, uuid
   - Design: Flat table like Entity Types

2. **Document_Types** (5 rows)
   - columns: name, uuid
   - Design: Flat table like Entity Types

3. **Project_States** (5 rows)
   - columns: name, uuid
   - Design: Flat table like Entity Types

4. **MI_Dimensions** (19 rows - Units of Measurement)
   - columns: name, uuid
   - Design: Flat table like Entity Types

## Priority 2: Reference Tables with Dependencies

5. **Employees** (149 rows)
   - DEPENDS ON: Countries (optional)
   - columns: name, personal_id, iban, phone, email, oris_id, internal_number, deleted
   - Design: Flat table like Counteragents

6. **MI_Producers** (21 rows - Manufacturers)
   - DEPENDS ON: Counteragents (optional)
   - columns: name, counteragent_id, uuid
   - Design: Flat table

7. **MI_Groups** (298 rows - Product Groups)
   - DEPENDS ON: MI_Dimensions
   - columns: name, dimension_id, uuid
   - Design: Flat table

## Priority 3: Complex Data Tables

8. **MI_Models** (11,432 rows - Product Models/SKUs)
   - DEPENDS ON: MI_Producers, MI_Groups, MI_Dimensions
   - columns: producer_id, group_id, model, internal_code, is_off_balance, oris_capex, uuid
   - Design: Flat table with filters

9. **Costs_Docs** (1,224 rows - Cost Documents)
   - DEPENDS ON: Counteragents, Financial_Codes (cost codes), Projects, Document_Types, Currencies
   - columns: counteragent_id, cost_code_id, project_id, doc_type_id, doc_number, date, amount, currency_id, rates, etc.
   - Design: Flat table with pagination

10. **Incomes** (525 rows - Income Documents)
    - DEPENDS ON: Projects, Document_Types, Currencies
    - columns: project_id, doc_type_id, doc_number, amount, currency_id, date, rates, etc.
    - Design: Flat table with pagination

11. **Service_History** (7,614 rows)
    - DEPENDS ON: MI_Models, Projects, Counteragents
    - columns: model_id, project_id, state, income, currency, date, etc.
    - Design: Flat table with pagination

12. **Ledger** (371 rows - Accounting Transactions)
    - DEPENDS ON: MI_Models, Counteragents, Financial_Codes, Projects, Currencies
    - columns: date, debit_account, credit_account, amount, currency, etc.
    - Design: Flat table with filters

13. **NBG** (5,427 rows - National Bank Exchange Rates)
    - columns: date, usd_gel, eur_gel, gbp_gel, etc.
    - Design: Flat table with date filter

## Already Implemented
- ✅ Countries
- ✅ Entity_Types  
- ✅ Counteragents
- ✅ Financial_Codes (hierarchical)
- ✅ Projects (just created)

## Implementation Order

### Phase 1: Simple Reference Tables (Today)
1. Currencies
2. Document_Types
3. Project_States
4. MI_Dimensions

### Phase 2: Dependent Reference Tables
5. Employees
6. MI_Producers
7. MI_Groups

### Phase 3: Product Catalog
8. MI_Models

### Phase 4: Transactional Data
9. Costs_Docs
10. Incomes
11. Service_History
12. Ledger
13. NBG

## Design Templates
- **Flat Table**: Counteragents/Entity_Types style (inline edit, search, filter)
- **Hierarchical Tree**: Financial_Codes style (expand/collapse, parent-child)
- **All tables**: Consistent styling, same components, responsive design
