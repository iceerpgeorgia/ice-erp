# Salary Accruals UI Updates - Summary

## Changes Made

### 1. Database Schema ✅
- ❌ Removed: `insurance_limit` column
- ✅ Renamed: `total_insurance` → `surplus_insurance`

### 2. UI Component Updates ✅
**File**: `components/figma/salary-accruals-table.tsx`

#### TypeScript Type Definition
- ❌ Removed: `insurance_limit: string | null;`
- ✅ Changed: `total_insurance` → `surplus_insurance`

#### Form State Variables
- ❌ Removed: `insuranceLimit` and `setInsuranceLimit`
- ✅ Changed: `totalInsurance` → `surplusInsurance`

#### Form Fields (Dialog)
- ❌ Removed: "Insurance Limit" input field
- ✅ Changed: "Total Insurance" label → "Surplus Insurance"

#### Table Columns
- ❌ Removed: "Insurance Limit" column header and data cells
- ✅ Changed: "Total Insurance" header → "Surplus Insurance"
- ✅ Reduced: `colSpan={12}` → `colSpan={11}` (for empty state)

### 3. API Route ✅
**File**: `app/api/salary-accruals/route.ts`
- Already using correct field name: `surplus_insurance`
- GET, POST, PUT operations all handle `surplus_insurance`

### 4. Data Import ✅
- **2846 records** imported successfully
- **2778 GEL** records + **68 USD** records
- All using `surplus_insurance` field

## Verification

### API Response Sample:
```json
{
  "id": "2753",
  "counteragent_name": "Employee Name",
  "payment_id": "NP_5beea0_NJ_319b2a_PRL122025",
  "net_sum": "3600",
  "surplus_insurance": "95",  ✅
  "deducted_insurance": "95",
  "currency_code": "GEL"
}
```

## Testing Instructions

1. **Visit**: http://localhost:3000/dictionaries/salary-accruals
2. **Verify**: 
   - Table displays "Surplus Insurance" column (not "Total Insurance")
   - No "Insurance Limit" column visible
   - Click "Add Accrual" button
   - Form shows "Surplus Insurance" field (not "Total Insurance")
   - No "Insurance Limit" field in form

## Column Layout (New)

| Employee | Payment ID | Financial Code | Month | Net Sum | Currency | **Surplus Insurance** | Ded. Insurance | Ded. Fitness | Ded. Fine | Actions |
|----------|-----------|----------------|-------|---------|----------|-----------------------|----------------|--------------|-----------|---------|
| 11 columns total (was 12) |

