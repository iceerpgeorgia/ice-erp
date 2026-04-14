# Bundle Payment Distribution Implementation Guide

## Overview
This guide provides step-by-step instructions to integrate bundle payment distribution into the projects form.

## ✅ Completed
1. Schema and migration created (`project_bundle_payments` table)
2. Prisma client regenerated
3. BundleDistributionGrid component created
4. API endpoint `/api/financial-codes/children/[parentUuid]` created

## TODO: Integration Steps

### Step 1: Update projects form state (components/figma/projects-table.tsx)

Add bundleDistribution to formData state (around line 340):

```typescript
const [formData, setFormData] = useState({
  projectName: \'\'\'\',
  date: \'\'\'\',
  value: \'\'\'\',
  oris1630: \'\'\'\',
  address: \'\'\'\',
  department: \'\'\'\',
  serviceState: \'\'\'\',
  insiderUuid: \'\'\'\',
  counteragentUuid: \'\'\'\',
  financialCodeUuid: \'\'\'\',
  currencyUuid: \'\'\'\',
  stateUuid: \'\'\'\',
  employees: [] as string[],
  bundleDistribution: [] as Array<{
    financialCodeUuid: string;
    financialCodeName: string;
    percentage: string;
    amount: string;
  }>
});
```

### Step 2: Add state to track if selected FC is a bundle

After formData state definition, add:

```typescript
const [isBundleFC, setIsBundleFC] = useState(false);
```

### Step 3: Add effect to check if selected FC is bundle

Add this useEffect after other useEffects:

```typescript
useEffect(() => {
  if (!formData.financialCodeUuid) {
    setIsBundleFC(false);
    return;
  }
  
  // Check if the selected financial code is a bundle
  const selectedFC = financialCodesList.find(fc => fc.uuid === formData.financialCodeUuid);
  if (selectedFC) {
    fetch(`/api/financial-codes/${formData.financialCodeUuid}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.is_bundle === \'\'boolean\'\') {
          setIsBundleFC(data.is_bundle);
          if (!data.is_bundle) {
            // Clear bundle distribution if not a bundle
            setFormData(prev => ({ ...prev, bundleDistribution: [] }));
          }
        }
      })
      .catch(err => console.error(\'\'Error checking bundle status:\'\', err));
  }
}, [formData.financialCodeUuid, financialCodesList]);
```

### Step 4: Add imports at top of component file

```typescript
import { BundleDistributionGrid, type BundleDistributionRow } from \'\'./bundle-distribution-grid\'\';
```

### Step 5: Add BundleDistributionGrid to Add Project Dialog

In the "Add Project Dialog" section (around line 1300), after the "State" field and before the "Employees" field, add:

```typescript
{/* Bundle Distribution - shown only for bundle financial codes */}
{isBundleFC && formData.value && parseFloat(formData.value) > 0 && (
  <div className="col-span-4">
    <BundleDistributionGrid
      bundleFinancialCodeUuid={formData.financialCodeUuid}
      projectValue={parseFloat(formData.value)}
      value={formData.bundleDistribution}
      onChange={(distribution) => setFormData({ ...formData, bundleDistribution: distribution })}
      disabled={isSaving}
    />
  </div>
)}
```

### Step 6: Add same component to Edit Project Dialog

Add the same component in the "Edit Project Dialog" section (around line 1550).

### Step 7: Update resetForm function

Update the resetForm function (around line 880) to include bundleDistribution:

```typescript
const resetForm = () => {
  setFormData({
    projectName: \'\'\'\',
    date: \'\'\'\',
    value: \'\'\'\',
    oris1630: \'\'\'\',
    address: \'\'\'\',
    department: \'\'\'\',
    serviceState: \'\'\'\',
    insiderUuid: fixedInsider?.insiderUuid || insidersList[0]?.insiderUuid || \'\'\'\',
    counteragentUuid: \'\'\'\',
    financialCodeUuid: \'\'\'\',
    currencyUuid: \'\'\'\',
    stateUuid: \'\'\'\',
    employees: [],
    bundleDistribution: []  // ADD THIS LINE
  });
  setFormErrors({});
  setIsBundleFC(false);  // ADD THIS LINE
};
```

### Step 8: Update startEdit function

Update startEdit function (around line 895) to load existing bundle distribution. Add at the end before setIsEditDialogOpen(true):

```typescript
// Load existing bundle distribution if this is a bundle FC
if (project.financialCodeUuid) {
  fetch(`/api/projects/bundle-distribution?projectUuid=${project.projectUuid}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        setFormData(prev => ({
          ...prev,
          bundleDistribution: data.map((row: any) => ({
            financialCodeUuid: row.financial_code_uuid,
            financialCodeName: row.financial_code_name || \'\'\'\',
            percentage: row.percentage?.toString() || \'\'\'\',
            amount: row.amount?.toString() || \'\'\'\'
          }))
        }));
      }
    })
    .catch(err => console.error(\'\'Error loading bundle distribution:\'\', err));
}
```

### Step 9: Update handleSave function (POST request)

In the handleSave function where the POST request is made (around line 840), update the request body:

```typescript
body: JSON.stringify({
  projectName: formData.projectName,
  date: formData.date,
  value: parseFloat(formData.value),
  oris1630: formData.oris1630 || null,
  address: formData.address || null,
  department: formData.department || null,
  serviceState: formData.serviceState || null,
  counteragentUuid: formData.counteragentUuid,
  financialCodeUuid: formData.financialCodeUuid,
  currencyUuid: formData.currencyUuid,
  stateUuid: formData.stateUuid,
  insider_uuid: formData.insiderUuid || null,
  insiderUuid: formData.insiderUuid || null,
  employees: formData.employees,
  bundleDistribution: formData.bundleDistribution  // ADD THIS LINE
})
```

### Step 10: Update handleSave function (PUT request)

Do the same for the PUT request in handleSave (around line 810).

### Step 11: Create bundle distribution GET API endpoint

Create file: `app/api/projects/bundle-distribution/route.ts`

```typescript
import { NextRequest, NextResponse } from \'\'next/server\'\';
import prisma from \'\'@/lib/prisma\'\';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get(\'\'projectUuid\'\');

    if (!projectUuid) {
      return NextResponse.json({ error: \'\'projectUuid is required\'\' }, { status: 400 });
    }

    const distribution = await prisma.$queryRawUnsafe<Array<{
      uuid: string;
      project_uuid: string;
      financial_code_uuid: string;
      financial_code_name: string;
      percentage: number | null;
      amount: number | null;
    }>>(
      `SELECT 
        pbp.uuid, 
        pbp.project_uuid, 
        pbp.financial_code_uuid,
        COALESCE(fc.validation, fc.name) as financial_code_name,
        pbp.percentage, 
        pbp.amount
       FROM project_bundle_payments pbp
       LEFT JOIN financial_codes fc ON fc.uuid = pbp.financial_code_uuid
       WHERE pbp.project_uuid = $1::uuid
       ORDER BY fc.sort_order, fc.code`,
      projectUuid
    );

    return NextResponse.json(distribution);
  } catch (error: any) {
    console.error(\'\'[GET /api/projects/bundle-distribution] Error:\'\', error);
    return NextResponse.json(
      { error: error?.message || \'\'Failed to fetch bundle distribution\'\' },
      { status: 500 }
    );
  }
}
```

### Step 12: Update POST /api/projects (app/api/projects/route.ts)

Add after project creation (around line 360), before audit log:

```typescript
// Save bundle distribution if provided
if (body.bundleDistribution && Array.isArray(body.bundleDistribution)) {
  for (const row of body.bundleDistribution) {
    const percentage = row.percentage ? parseFloat(row.percentage) : null;
    const amount = row.amount ? parseFloat(row.amount) : null;

    if ((percentage !== null && percentage > 0) || (amount !== null && amount > 0)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO project_bundle_payments (project_uuid, financial_code_uuid, percentage, amount, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, NOW())`,
        project.project_uuid,
        row.financialCodeUuid,
        percentage,
        amount
      );
    }
  }
}
```

### Step 13: Update PATCH /api/projects

Add similar code to PATCH handler (around line 560).

### Step 14: Update PUT /api/projects/[id]/route.ts

Add similar code to PUT handler.

### Step 15: Create API endpoint to check if FC is bundle

Create file: `app/api/financial-codes/[uuid]/route.ts`

```typescript
import { NextRequest, NextResponse } from \'\'next/server\'\';
import prisma from \'\'@/lib/prisma\'\';

export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;

    if (!uuid) {
      return NextResponse.json({ error: \'\'UUID is required\'\' }, { status: 400 });
    }

    const fc = await prisma.$queryRawUnsafe<Array<{
      uuid: string;
      code: string;
      name: string;
      validation: string | null;
      is_bundle: boolean;
      is_active: boolean;
    }>>(
      `SELECT uuid, code, name, validation, is_bundle, is_active
       FROM financial_codes
       WHERE uuid = $1::uuid LIMIT 1`,
      uuid
    );

    if (fc.length === 0) {
      return NextResponse.json({ error: \'\'Financial code not found\'\' }, { status: 404 });
    }

    return NextResponse.json(fc[0]);
  } catch (error: any) {
    console.error(\'\'[GET /api/financial-codes/[uuid]] Error:\'\', error);
    return NextResponse.json(
      { error: error?.message || \'\'Failed to fetch financial code\'\' },
      { status: 500 }
    );
  }
}
```

## Testing Checklist

1. [ ] Create a new project with a bundle financial code
2. [ ] Verify bundle distribution grid appears
3. [ ] Enter percentages and verify sums calculate correctly
4. [ ] Enter sums and verify percentages are disabled
5. [ ] Verify validation (totals must equal 100% or project value)
6. [ ] Save project and verify bundle distribution is saved
7. [ ] Edit project and verify bundle distribution loads
8. [ ] Update bundle distribution and verify changes save
9. [ ] Create project with non-bundle FC and verify grid does not appear

## Notes

- The component automatically detects whether user is entering percentages or amounts
- Percentages must sum to 100%
- Amounts must sum to project value
- If any percentage is entered, all amounts are calculated automatically
- If any amount is entered, all percentages are disabled
