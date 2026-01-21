# Salary Management System - Analysis & Recommendations

## 📊 Current State Analysis

### Excel File: Salary_Accruals.xlsx

**Dataset Overview:**
- **Total Records:** 2,846 salary accrual entries
- **Time Period:** February 2023 - January 2026 (36 months)
- **Unique Employees:** 151 employees
- **Total Salary Amount:** 6,430,133.16 GEL
- **Average Monthly Salary:** 2,259.36 GEL
- **Salary Range:** 0 - 12,000 GEL

### Key Observations

#### 1. **Strong Data Structure** ✅
Your Excel has comprehensive columns covering:
- **Employee Information:** Name, Personal ID (პ.ნ.), Gender, IBAN
- **Financial Details:** Salary, Currency, Net Amount, Pension (2%), Insurance
- **Accounting Links:** Financial Codes, Counteragent IDs, Code IDs
- **Payment Tracking:** Order IDs, Payment Status, Balance
- **Project Attribution:** Responsible person, Project codes

#### 2. **Critical Issues** ⚠️

**A. Payment Status Flag Issue**
```
All 2,846 records show: გადახდილი = 0.0 (False)
```
- No records marked as paid
- This suggests either:
  - Manual payment tracking not maintained
  - Need for automated payment reconciliation
  - Data migration issue from previous system

**B. High NULL Rates in Key Fields**
- **Insurance (დაზღვევა ხელფასიდან):** 81.6% null
- **Fitness Pass (ფიტპასი):** 94.8% null
- **Penalties (ჯარიმა):** 99.3% null
- **Gender (სქესი):** 46.0% null
- **ORIS ID:** 7.6% null
- **IBAN:** 1.7% null

**C. Financial Code Distribution**
Top categories:
1. Administration Fixed Salaries: 1,209 records (42.5%)
2. Elevator Service Salaries: 951 records (33.4%)
3. Installation Salaries: 293 records (10.3%)
4. MEP Equipment Service: 189 records (6.6%)
5. Management Fixed Salaries: 181 records (6.4%)

#### 3. **Database Integration Gaps** 🔴

**Current Database Schema:**
- ✅ `counteragents` - Employee/contractor master data
- ✅ `projects` - Project master with financial codes
- ✅ `project_employees` - Project-employee assignments
- ✅ `financial_codes` - Expense classification
- ✅ `payments` - Payment tracking system
- ❌ **NO dedicated salary/payroll tables**

---

## 🎯 Recommended Architecture

### Database Schema Design

#### **1. New Table: `salary_accruals`**
Master table for all salary accruals:

```sql
CREATE TABLE salary_accruals (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  
  -- Employee Reference
  employee_counteragent_uuid UUID NOT NULL REFERENCES counteragents(uuid),
  employee_personal_id VARCHAR(11),
  employee_name TEXT NOT NULL,
  iban VARCHAR(34),
  
  -- Period
  accrual_date DATE NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  
  -- Salary Components (all in base currency)
  base_salary DECIMAL(15, 2) NOT NULL,
  gross_salary DECIMAL(15, 2) NOT NULL,
  pension_2_percent DECIMAL(15, 2) DEFAULT 0,
  health_insurance_employee DECIMAL(15, 2) DEFAULT 0,
  health_insurance_company DECIMAL(15, 2) DEFAULT 0,
  fitness_benefit DECIMAL(15, 2) DEFAULT 0,
  penalty_deduction DECIMAL(15, 2) DEFAULT 0,
  other_deductions DECIMAL(15, 2) DEFAULT 0,
  net_payable DECIMAL(15, 2) NOT NULL,
  
  -- Currency
  currency_uuid UUID NOT NULL REFERENCES currencies(uuid),
  currency_code VARCHAR(3) NOT NULL,
  
  -- Financial Accounting
  financial_code_uuid UUID NOT NULL REFERENCES financial_codes(uuid),
  financial_code_display TEXT,
  project_uuid UUID REFERENCES projects(project_uuid),
  responsible_person VARCHAR(255),
  
  -- Accounting Entries (debits/credits for double-entry)
  debit_account_7_4_10_3_1_30 DECIMAL(15, 2) DEFAULT 0,
  credit_account_3_1_30_3_3_22 DECIMAL(15, 2) DEFAULT 0,
  credit_account_3_1_30_3_3_20 DECIMAL(15, 2) DEFAULT 0,
  
  -- Payment Status
  payment_order_id VARCHAR(100),
  payment_order_batch VARCHAR(50),
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date DATE,
  paid_amount DECIMAL(15, 2),
  payment_balance DECIMAL(15, 2) DEFAULT 0,
  payment_uuid UUID REFERENCES payments(payment_uuid),
  
  -- Gender (for statistical reporting)
  gender VARCHAR(20),
  
  -- Integration IDs
  oris_id INTEGER,
  excel_row_id INTEGER,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255),
  
  -- Constraints
  CONSTRAINT valid_salary CHECK (base_salary >= 0),
  CONSTRAINT valid_net CHECK (net_payable >= 0),
  CONSTRAINT unique_employee_period UNIQUE (employee_counteragent_uuid, period_year, period_month)
);

-- Indexes for performance
CREATE INDEX idx_salary_accruals_employee ON salary_accruals(employee_counteragent_uuid);
CREATE INDEX idx_salary_accruals_period ON salary_accruals(period_year, period_month);
CREATE INDEX idx_salary_accruals_date ON salary_accruals(accrual_date);
CREATE INDEX idx_salary_accruals_financial_code ON salary_accruals(financial_code_uuid);
CREATE INDEX idx_salary_accruals_project ON salary_accruals(project_uuid);
CREATE INDEX idx_salary_accruals_payment_status ON salary_accruals(is_paid, paid_date);
CREATE INDEX idx_salary_accruals_order ON salary_accruals(payment_order_id);
```

#### **2. New Table: `salary_payment_orders`**
Track batch payment orders:

```sql
CREATE TABLE salary_payment_orders (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  
  order_id VARCHAR(100) UNIQUE NOT NULL,
  order_batch VARCHAR(50) NOT NULL,
  
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  
  total_employees INTEGER NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  currency_uuid UUID NOT NULL REFERENCES currencies(uuid),
  
  status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, APPROVED, PROCESSING, COMPLETED, FAILED
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  approved_at TIMESTAMP,
  approved_by VARCHAR(255),
  processed_at TIMESTAMP,
  
  notes TEXT
);

CREATE INDEX idx_payment_orders_batch ON salary_payment_orders(order_batch);
CREATE INDEX idx_payment_orders_period ON salary_payment_orders(period_year, period_month);
CREATE INDEX idx_payment_orders_status ON salary_payment_orders(status);
```

#### **3. Enhanced Table: `project_employees`**
Add salary rate tracking:

```sql
ALTER TABLE project_employees ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(15, 2);
ALTER TABLE project_employees ADD COLUMN IF NOT EXISTS rate_currency_uuid UUID REFERENCES currencies(uuid);
ALTER TABLE project_employees ADD COLUMN IF NOT EXISTS effective_from DATE;
ALTER TABLE project_employees ADD COLUMN IF NOT EXISTS effective_to DATE;
ALTER TABLE project_employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50); -- FULL_TIME, CONTRACT, HOURLY
```

---

## 🔧 Implementation Plan

### Phase 1: Database Setup (Week 1)

**Step 1.1: Create Migration Script**
```bash
# Create Prisma migration
pnpm prisma migrate dev --name add_salary_management_tables

# Or use raw SQL migration
node scripts/apply-salary-schema-migration.js
```

**Step 1.2: Update Prisma Schema**
Add new models to `prisma/schema.prisma`

**Step 1.3: Import Historical Data**
```bash
python scripts/import_salary_accruals.py
```

### Phase 2: Data Import Script (Week 1-2)

Create `scripts/import_salary_accruals.py`:

```python
import pandas as pd
import psycopg2
from datetime import datetime
import uuid

def import_salary_accruals():
    # Read Excel
    df = pd.read_excel('Salary_Accruals.xlsx', sheet_name='Salary_Accruals')
    
    # Connect to database
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    
    # Process each row
    for idx, row in df.iterrows():
        # Extract employee personal ID from name field
        personal_id = extract_personal_id(row['თანამშრომელი'])
        
        # Map to counteragent
        counteragent_uuid = lookup_counteragent(personal_id, row['Counteragent ID'])
        
        # Insert salary accrual
        cursor.execute("""
            INSERT INTO salary_accruals (
                employee_counteragent_uuid,
                employee_personal_id,
                employee_name,
                iban,
                accrual_date,
                period_year,
                period_month,
                base_salary,
                gross_salary,
                pension_2_percent,
                health_insurance_employee,
                health_insurance_company,
                fitness_benefit,
                penalty_deduction,
                net_payable,
                currency_uuid,
                currency_code,
                financial_code_uuid,
                payment_order_id,
                payment_order_batch,
                debit_account_7_4_10_3_1_30,
                credit_account_3_1_30_3_3_22,
                credit_account_3_1_30_3_3_20,
                responsible_person,
                gender,
                oris_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            counteragent_uuid,
            personal_id,
            row['თანამშრომელი'],
            row['IBAN'],
            row['Date'],
            row['Date'].year,
            row['Date'].month,
            row['ხელფასი'],
            row['ექვივ. GEL'],
            row['საპენსიო 2%'],
            row['დაზღვევა ხელფასიდან'],
            row['დაზღვევა კომპანია'],
            row['ფიტპასი'],
            row['ჯარიმა'],
            row['ხელზე ასაღები'],
            get_currency_uuid(row['ვალუტა']),
            row['ვალუტა'],
            row['Code ID'],
            row['Order_ID'],
            row['Salary_Order'],
            row['7_4_10/3_1_30'],
            row['3_1_30/3_3_22'],
            row['3_1_30/3_3_20'],
            row['პასუხისმგებელი'],
            row['სქესი'],
            row['ORIS ID']
        ))
    
    conn.commit()
    print(f"✅ Imported {len(df)} salary accrual records")
```

### Phase 3: Payment Reconciliation (Week 2)

**Match accruals to actual payments:**

```python
def reconcile_salary_payments():
    """
    Match salary accruals to actual bank payments
    using Order_ID and payment dates
    """
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    
    # Find matching payments
    cursor.execute("""
        UPDATE salary_accruals sa
        SET 
            is_paid = TRUE,
            paid_date = p.payment_date,
            paid_amount = p.amount,
            payment_uuid = p.payment_uuid
        FROM payments p
        WHERE sa.payment_order_id = p.external_reference_id
        AND p.status = 'COMPLETED'
        AND sa.is_paid = FALSE
    """)
    
    updated = cursor.rowcount
    conn.commit()
    print(f"✅ Reconciled {updated} salary payments")
```

### Phase 4: API Endpoints (Week 3)

**Create RESTful API:**

`app/api/salary-accruals/route.ts`:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period'); // "2024-01"
  const employeeUuid = searchParams.get('employee_uuid');
  
  const accruals = await prisma.salary_accruals.findMany({
    where: {
      ...(period && {
        period_year: parseInt(period.split('-')[0]),
        period_month: parseInt(period.split('-')[1])
      }),
      ...(employeeUuid && { employee_counteragent_uuid: employeeUuid })
    },
    include: {
      employee: true,
      financial_code: true,
      project: true,
      payment: true
    },
    orderBy: { accrual_date: 'desc' }
  });
  
  return Response.json({ data: accruals });
}
```

`app/api/salary-orders/route.ts`:
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  
  // Create new salary payment order
  const order = await prisma.salary_payment_orders.create({
    data: {
      order_id: generateOrderId(),
      order_batch: body.batch,
      period_year: body.year,
      period_month: body.month,
      total_employees: body.employees.length,
      total_amount: body.total,
      currency_uuid: body.currency_uuid,
      created_by: session.user.email
    }
  });
  
  return Response.json({ order });
}
```

### Phase 5: UI Components (Week 3-4)

**Create salary management interface:**

`app/salary-management/page.tsx`:
```typescript
// Main salary dashboard
- Monthly salary accrual overview
- Employee salary list
- Payment status tracking
- Export to Excel/PDF
```

`app/salary-management/accruals/page.tsx`:
```typescript
// Accrual management
- Create new accruals
- Edit existing accruals
- Bulk import from Excel
```

`app/salary-management/orders/page.tsx`:
```typescript
// Payment order management
- Create payment batch
- Approve pending orders
- Track payment status
```

---

## 📋 Data Quality Improvements

### 1. **Fill Missing Data**

**Gender (46% missing):**
```sql
-- Add gender based on Georgian naming conventions or manual update
UPDATE salary_accruals
SET gender = CASE
  WHEN employee_name ILIKE '%ძე%' THEN 'მამრობითი'
  WHEN employee_name ILIKE '%შვილი%' THEN 'მდედრობითი'
  ELSE NULL
END
WHERE gender IS NULL;
```

**IBAN (1.7% missing):**
- Request from employees
- Add validation on employee onboarding

**Insurance:**
- Clarify insurance policy rules
- Auto-calculate based on salary ranges

### 2. **Payment Status Reconciliation**

**Critical Priority:**
```python
# Match payment_order_id to payments table
# Update is_paid flag
# Calculate payment_balance
```

### 3. **Data Validation Rules**

Add constraints:
- Personal ID format validation (11 digits)
- IBAN format validation (GE + 22 chars)
- Salary ranges by role
- Pension calculation accuracy (exactly 2%)
- Net = Gross - Deductions

---

## 🎯 Benefits of Proposed System

### 1. **Automated Calculations** ✅
- Auto-calculate pension (2%)
- Auto-calculate insurance based on rules
- Auto-calculate net salary
- Exchange rate conversions

### 2. **Payment Tracking** ✅
- Real-time payment status
- Auto-reconciliation with bank statements
- Payment history per employee
- Outstanding balance tracking

### 3. **Reporting** ✅
- Monthly salary reports
- Per-project cost allocation
- Employee salary history
- Tax authority reports
- Social insurance reports

### 4. **Integration** ✅
- Links to counteragents (employees)
- Links to projects (cost allocation)
- Links to financial codes (accounting)
- Links to payments (bank transactions)

### 5. **Audit Trail** ✅
- Full change history
- Who created/modified
- Payment approval workflow
- Compliance documentation

---

## 🚀 Quick Start Commands

```bash
# 1. Create database schema
pnpm prisma migrate dev --name add_salary_management

# 2. Generate Prisma client
pnpm prisma generate

# 3. Import historical data
python scripts/import_salary_accruals.py

# 4. Reconcile payments
python scripts/reconcile_salary_payments.py

# 5. Verify data
node scripts/verify-salary-data.js

# 6. Start development server
pnpm dev
```

---

## 📊 Next Steps

1. **Review & Approve** this architecture
2. **Create migration scripts** (salary_accruals, salary_payment_orders)
3. **Build import script** to load historical data
4. **Implement reconciliation** logic for payment matching
5. **Create API endpoints** for CRUD operations
6. **Build UI components** for salary management
7. **Add reporting** features

---

## 🎓 Key Decisions Needed

1. **Should we maintain the Excel file or fully migrate to DB?**
   - Recommendation: **Migrate to DB**, keep Excel as backup/export
   
2. **How to handle multi-currency salaries?**
   - Recommendation: Store in base currency, add exchange rate reference
   
3. **Payment approval workflow?**
   - Recommendation: Add approval_status, approver fields
   
4. **Historical data: Import all 2,846 records?**
   - Recommendation: **Yes**, for complete audit trail

5. **Integration with existing payments system?**
   - Recommendation: Link via payment_order_id to payments table

---

**Ready to proceed?** Let me know which phase you'd like to start with!
