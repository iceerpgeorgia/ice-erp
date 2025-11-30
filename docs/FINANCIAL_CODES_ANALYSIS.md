# Financial Codes System - Analysis & Best Practices

> **Verified Count**: 244 codes total (all with valid UUIDs)
> - 179 Addable rows (leaf nodes for transactions)
> - 24 Subgroups
> - 11 Groups
> - 22 Formula codes
> - 8 P&L Formula codes

## System Overview
Based on the Excel analysis, you have a **hierarchical chart of accounts** with:
- **244 total codes** (all with valid UUIDs)
- **4-level nested structure** (Level1 → Level2 → Level3 → Level4)
- **5 node types**: 
  - **22 Formula codes** (calculated fields like "საწყისი ნაშთი")
  - **11 Groups** (top-level categories)
  - **24 Subgroups** (subcategories)
  - **179 Addable rows** (leaf nodes for actual transactions)
  - **8 PL Formula codes** (P&L calculation formulas)
- **Statement applicability**: P&L (Profit & Loss), CF (Cash Flow), or Both
- **Signs**: + (income/inflow) or - (expense/outflow)
- **UUID identifiers** for ALL codes (100% coverage)

## Hierarchical Structure Example
```
1. (+) შემოსავლები რეალიზაციიდან [Group, PL+CF]
├─ 1.1. (+) ლიფტების რეალიზაცია [Subgroup, PL+CF]
│  ├─ 1.1.1. (+) შემოსავალი ლიფტების რეალიზაციიდან [Addable row, PL+CF]
│  │  ├─ 1.1.1.1. (+) ლიფტების ავანსი [Addable row, CF only]
│  │  ├─ 1.1.1.2. (+) ლიფტების საქარხნო მზაობის ავანსი [Addable row, CF only]
│  │  └─ 1.1.1.3. (+) ლიფტების საბაჟოზე შემოსვლის ავანსი [Addable row, CF only]
│  ├─ 1.1.2. (+) ლიფტების სერვისი - გეგმიური [Addable row, PL+CF]
│  └─ 1.1.3. (+) ლიფტების სერვისი - არაგეგმიური [Addable row, PL+CF]
└─ 1.2. (+) MEP დანადგარები [Subgroup, PL+CF]
   ├─ 1.2.1. (+) MEP რეალიზაცია [Addable row, PL+CF]
   └─ 1.2.2. (+) MEP სერვისი [Addable row, PL+CF]
```

---

## Recommended Database Schema

### Approach 1: Closure Table Pattern (RECOMMENDED) ⭐

This is the **most flexible and performant** approach for hierarchical data.

```prisma
model FinancialCode {
  id                String   @id @default(uuid()) @db.Uuid
  code              String   @unique // "1.1.1.1", "F0_", etc.
  name              String   // Georgian name
  nameEn            String?  // English translation
  sign              String   // "+" or "-"
  nodeType          String   // "Formula", "PL Formula", "Group", "Subgroup", "Addable row"
  
  // Hierarchy levels (for fast querying)
  level1            Int
  level2            Int      @default(0)
  level3            Int      @default(0)
  level4            Int      @default(0)
  depth             Int      // 1, 2, 3, or 4
  
  // Statement applicability
  appliesToPL       Boolean  @default(false)
  appliesToCF       Boolean  @default(false)
  
  // Formula fields (for calculated codes)
  isFormula         Boolean  @default(false)
  formulaExpression String?  // Store the calculation logic
  
  // Additional metadata
  category          String?  // "ლიფტების", "MEP დანადგარები", etc.
  customsCategory   String?
  orisAccount       String?
  validation        String?  // Validation rules from Excel
  orderDescription  String?  // Description field from Excel
  
  // Audit fields
  isDeleted         Boolean  @default(false)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  ancestors         FinancialCodePath[] @relation("Descendant")
  descendants       FinancialCodePath[] @relation("Ancestor")
  transactions      Transaction[]
  
  @@index([code])
  @@index([level1, level2, level3, level4])
  @@index([nodeType])
  @@index([isFormula])
  @@map("financial_codes")
}

// Closure table for efficient hierarchy queries
model FinancialCodePath {
  id           String        @id @default(uuid()) @db.Uuid
  ancestorId   String        @db.Uuid
  descendantId String        @db.Uuid
  depth        Int           // 0 = self, 1 = direct child, 2+ = deeper
  
  ancestor     FinancialCode @relation("Ancestor", fields: [ancestorId], references: [id], onDelete: Cascade)
  descendant   FinancialCode @relation("Descendant", fields: [descendantId], references: [id], onDelete: Cascade)
  
  @@unique([ancestorId, descendantId])
  @@index([ancestorId, depth])
  @@index([descendantId])
  @@map("financial_code_paths")
}

// Transaction model using financial codes
model Transaction {
  id                 String        @id @default(uuid()) @db.Uuid
  date               DateTime
  amount             Decimal       @db.Decimal(15, 2)
  description        String
  financialCodeId    String        @db.Uuid
  
  // Relations
  financialCode      FinancialCode @relation(fields: [financialCodeId], references: [id])
  
  // Audit
  createdAt          DateTime      @default(now())
  createdBy          String?
  
  @@index([financialCodeId, date])
  @@index([date])
  @@map("transactions")
}
```

### Approach 2: Adjacency List (Simpler but slower queries)

```prisma
model FinancialCode {
  id           String          @id @default(uuid()) @db.Uuid
  code         String          @unique
  name         String
  parentId     String?         @db.Uuid
  
  parent       FinancialCode?  @relation("Hierarchy", fields: [parentId], references: [id])
  children     FinancialCode[] @relation("Hierarchy")
  
  // ... rest of fields same as above
}
```

❌ **Not recommended** for your use case because:
- Recursive queries are needed to get all descendants
- Hard to calculate aggregations up the tree
- Performance issues with deep hierarchies

---

## Best Practices Implementation

### 1. **Import Script from Excel**

```typescript
// scripts/import-financial-codes.ts
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function importFinancialCodes() {
  console.log('Starting financial codes import...\n');
  
  const workbook = XLSX.readFile('Financial Codes Concept.xlsx');
  const worksheet = workbook.Sheets['Codes'];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${data.length} rows in Excel`);
  
  // First pass: Create all codes
  const codeMap = new Map<string, string>(); // code -> id
  let imported = 0;
  let skipped = 0;
  
  for (const row of data) {
    if (!row.Code || row.Code === 'Code') {
      skipped++;
      continue; // Skip header and empty rows
    }
    
    const guid = row['Code_GUID/'];
    if (!guid) {
      console.warn(`⚠️  Code ${row.Code} has no GUID, skipping`);
      skipped++;
      continue;
    }
    
    const nodeType = row['IS Group/Formula'];
    const isFormula = nodeType === 'Formula' || nodeType === 'PL Formula';
    
    try {
      await prisma.financialCode.upsert({
        where: { code: row.Code },
        create: {
          id: guid,
          code: row.Code,
          name: row.Name || '',
          sign: row.Sign || '+',
          nodeType: nodeType || 'Addable row',
          level1: parseInt(row.Level1) || 0,
          level2: parseInt(row.Level2) || 0,
          level3: parseInt(row.Level3) || 0,
          level4: parseInt(row.Level4) || 0,
          depth: calculateDepth(row),
          appliesToPL: row.PL === 'Yes',
          appliesToCF: row.CF === 'Yes',
          isFormula,
          formulaExpression: isFormula ? row.Validation : null,
          category: row.Category,
          orisAccount: row['ORIS ACCOUNT'],
          customsCategory: row['Customs Category'],
          validation: row.Validation,
          orderDescription: row['Orders Description'],
        },
        update: {
          name: row.Name || '',
          sign: row.Sign || '+',
          nodeType: nodeType || 'Addable row',
          appliesToPL: row.PL === 'Yes',
          appliesToCF: row.CF === 'Yes',
          isFormula,
          formulaExpression: isFormula ? row.Validation : null,
          category: row.Category,
          validation: row.Validation,
        },
      });
      
      codeMap.set(row.Code, guid);
      imported++;
      
      if (imported % 50 === 0) {
        process.stdout.write(`\r  Imported: ${imported}/${data.length - skipped}`);
      }
    } catch (error) {
      console.error(`\n❌ Error importing ${row.Code}:`, error.message);
    }
  }
  
  console.log(`\n\n✓ Imported ${imported} codes, skipped ${skipped}\n`);
  
  // Second pass: Build closure table
  console.log('Building hierarchy relationships...');
  await buildClosureTable();
  
  // Verification
  const counts = await prisma.financialCode.groupBy({
    by: ['nodeType'],
    _count: true,
  });
  
  console.log('\n=== Import Summary ===');
  counts.forEach(({ nodeType, _count }) => {
    console.log(`  ${nodeType}: ${_count}`);
  });
  
  console.log('\n✅ Import complete!');
}

async function buildClosureTable() {
  // Delete existing paths
  await prisma.financialCodePath.deleteMany({});
  
  // Get all codes sorted by depth
  const codes = await prisma.financialCode.findMany({
    where: {
      isFormula: false, // Don't include formulas in hierarchy
    },
    orderBy: [
      { level1: 'asc' },
      { level2: 'asc' },
      { level3: 'asc' },
      { level4: 'asc' },
    ],
  });
  
  console.log(`  Processing ${codes.length} codes...`);
  let pathsCreated = 0;
  
  for (const code of codes) {
    // Self-reference (depth 0)
    await prisma.financialCodePath.create({
      data: {
        ancestorId: code.id,
        descendantId: code.id,
        depth: 0,
      },
    });
    pathsCreated++;
    
    // Find all ancestors
    const ancestors = codes.filter(ancestor => 
      isAncestor(ancestor, code)
    );
    
    for (const ancestor of ancestors) {
      const depth = calculateDepthBetween(ancestor, code);
      await prisma.financialCodePath.create({
        data: {
          ancestorId: ancestor.id,
          descendantId: code.id,
          depth,
        },
      });
      pathsCreated++;
    }
    
    if (pathsCreated % 100 === 0) {
      process.stdout.write(`\r  Created ${pathsCreated} relationships...`);
    }
  }
  
  console.log(`\n  ✓ Created ${pathsCreated} hierarchy relationships`);
}

function isAncestor(potential: any, child: any): boolean {
  if (potential.level1 !== child.level1) return false;
  
  if (child.depth === 1) return false; // Top level has no ancestors
  
  if (child.depth === 2) {
    return potential.depth === 1 && potential.level2 === 0;
  }
  
  if (child.depth === 3) {
    return (
      (potential.depth === 1 && potential.level2 === 0) ||
      (potential.depth === 2 && potential.level2 === child.level2 && potential.level3 === 0)
    );
  }
  
  if (child.depth === 4) {
    return (
      (potential.depth === 1 && potential.level2 === 0) ||
      (potential.depth === 2 && potential.level2 === child.level2 && potential.level3 === 0) ||
      (potential.depth === 3 && potential.level2 === child.level2 && potential.level3 === child.level3 && potential.level4 === 0)
    );
  }
  
  return false;
}

function calculateDepthBetween(ancestor: any, child: any): number {
  return child.depth - ancestor.depth;
}

function calculateDepth(row: any): number {
  if (row.Level4 && parseInt(row.Level4) > 0) return 4;
  if (row.Level3 && parseInt(row.Level3) > 0) return 3;
  if (row.Level2 && parseInt(row.Level2) > 0) return 2;
  return 1;
}

// Run import
importFinancialCodes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 2. **API Endpoints**

```typescript
// app/api/financial-codes/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/financial-codes - Get all codes as tree
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rootCode = searchParams.get('root');
  const includeChildren = searchParams.get('children') !== 'false';
  
  if (rootCode) {
    // Get specific subtree
    const root = await prisma.financialCode.findUnique({
      where: { code: rootCode },
    });
    
    if (!root) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    
    if (includeChildren) {
      // Get all descendants using closure table
      const descendants = await prisma.$queryRaw`
        SELECT fc.* 
        FROM financial_codes fc
        INNER JOIN financial_code_paths fcp ON fcp.descendant_id = fc.id
        WHERE fcp.ancestor_id = ${root.id}
        ORDER BY fc.level1, fc.level2, fc.level3, fc.level4
      `;
      
      return NextResponse.json({
        root,
        children: buildTree(descendants, root.id),
      });
    }
    
    return NextResponse.json(root);
  }
  
  // Get top-level codes
  const topLevel = await prisma.financialCode.findMany({
    where: { depth: 1 },
    orderBy: { level1: 'asc' },
  });
  
  return NextResponse.json(topLevel);
}

// GET /api/financial-codes/tree - Full hierarchical tree
export async function getTree() {
  const allCodes = await prisma.financialCode.findMany({
    orderBy: [
      { level1: 'asc' },
      { level2: 'asc' },
      { level3: 'asc' },
      { level4: 'asc' },
    ],
  });
  
  return buildTree(allCodes);
}

function buildTree(codes: FinancialCode[], rootId?: string) {
  const codeMap = new Map(codes.map(c => [c.id, { ...c, children: [] }]));
  const roots: any[] = [];
  
  for (const code of codes) {
    const node = codeMap.get(code.id);
    if (!node) continue;
    
    // Find parent
    const parent = codes.find(c => isDirectParent(c, code));
    
    if (parent && codeMap.has(parent.id)) {
      codeMap.get(parent.id)!.children.push(node);
    } else if (code.depth === 1) {
      roots.push(node);
    }
  }
  
  return rootId ? codeMap.get(rootId)?.children || [] : roots;
}

function isDirectParent(potential: FinancialCode, child: FinancialCode): boolean {
  if (potential.level1 !== child.level1) return false;
  if (child.depth - potential.depth !== 1) return false;
  
  if (child.depth === 2) {
    return potential.depth === 1 && potential.level2 === 0;
  }
  if (child.depth === 3) {
    return potential.level2 === child.level2 && potential.level3 === 0;
  }
  if (child.depth === 4) {
    return potential.level2 === child.level2 && 
           potential.level3 === child.level3 && 
           potential.level4 === 0;
  }
  
  return false;
}
```

### 3. **React Component for Tree Display**

```typescript
// components/financial-code-tree.tsx
'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface FinancialCodeNode {
  id: string;
  code: string;
  name: string;
  sign: string;
  nodeType: string;
  appliesToPL: boolean;
  appliesToCF: boolean;
  children: FinancialCodeNode[];
}

export function FinancialCodeTree({ 
  data, 
  onSelect 
}: { 
  data: FinancialCodeNode[]; 
  onSelect?: (code: FinancialCodeNode) => void;
}) {
  return (
    <div className="space-y-1">
      {data.map(node => (
        <TreeNode key={node.id} node={node} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TreeNode({ 
  node, 
  onSelect, 
  level = 0 
}: { 
  node: FinancialCodeNode; 
  onSelect?: (code: FinancialCodeNode) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = node.nodeType === 'Addable row';
  
  return (
    <div>
      <div 
        className={`flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer`}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          if (isLeaf && onSelect) onSelect(node);
        }}
      >
        {hasChildren && (
          <button className="p-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        
        <span className={`font-mono text-sm ${isLeaf ? 'text-blue-600' : 'font-semibold'}`}>
          {node.code}
        </span>
        
        <span className="text-sm">{node.name}</span>
        
        <div className="ml-auto flex gap-1">
          {node.appliesToPL && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">P&L</span>
          )}
          {node.appliesToCF && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">CF</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded ${
            node.sign === '+' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}>
            {node.sign}
          </span>
        </div>
      </div>
      
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Reporting Queries

### Get P&L Statement
```sql
-- Get all income and expenses with aggregations
SELECT 
  fc.code,
  fc.name,
  fc.sign,
  fc.depth,
  SUM(t.amount) as total
FROM financial_codes fc
LEFT JOIN transactions t ON t.financial_code_id = fc.id
WHERE fc.applies_to_pl = true
  AND t.date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY fc.id, fc.code, fc.name, fc.sign, fc.depth
ORDER BY fc.level1, fc.level2, fc.level3, fc.level4;
```

### Get Cash Flow Statement
```sql
-- Similar to P&L but filter by applies_to_cf
SELECT 
  fc.code,
  fc.name,
  SUM(CASE WHEN fc.sign = '+' THEN t.amount ELSE -t.amount END) as cash_flow
FROM financial_codes fc
LEFT JOIN transactions t ON t.financial_code_id = fc.id
WHERE fc.applies_to_cf = true
  AND t.date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY fc.id, fc.code, fc.name
ORDER BY fc.level1, fc.level2, fc.level3, fc.level4;
```

### Get Subtree Totals (using closure table)
```sql
-- Get total for code "1.1" including all descendants
SELECT 
  SUM(t.amount) as subtotal
FROM transactions t
INNER JOIN financial_code_paths fcp ON fcp.descendant_id = t.financial_code_id
INNER JOIN financial_codes fc_parent ON fc_parent.id = fcp.ancestor_id
WHERE fc_parent.code = '1.1'
  AND t.date BETWEEN '2025-01-01' AND '2025-12-31';
```

---

## Key Recommendations

1. ✅ **Use Closure Table** - Best for your nested structure with reports
2. ✅ **Store UUIDs** - Keep the existing GUIDs from Excel
3. ✅ **Cache the tree** - Load once, use React state for navigation
4. ✅ **Validate transactions** - Only allow posting to "Addable row" codes
5. ✅ **Index properly** - Index level1-4 for fast filtering
6. ✅ **Soft deletes** - Never hard-delete codes with transactions
7. ✅ **Version control** - Track changes to chart of accounts over time
8. ✅ **Materialized paths** - Consider adding "path" field like "1/1/1/2" for simpler queries

Would you like me to:
1. Create the complete migration script from your Excel?
2. Build the full API endpoints?
3. Create the React component for code selection in transaction forms?
