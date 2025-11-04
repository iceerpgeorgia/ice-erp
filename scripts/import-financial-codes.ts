import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExcelRow {
  Code: string;
  Sign: string;
  'IS Group/Formula': string;
  Name: string;
  'Name en': string;
  PL: string;
  CF: string;
  'Code_GUID/': string;
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  Category: string;
  'Customs Category': string;
  'Oris Account': string;
  Validation: string;
  'Order description': string;
  'Formula expression': string;
}

async function main() {
  console.log('🚀 Starting Financial Codes Import...\n');

  // Read Excel file
  const excelPath = path.join(process.cwd(), 'Financial Codes Concept.xlsx');
  console.log(`📖 Reading Excel file: ${excelPath}`);
  
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Total rows in Excel: ${data.length}\n`);

  // Filter codes with valid GUIDs
  const validCodes = data.filter(row => {
    const guid = row['Code_GUID/'];
    return guid && typeof guid === 'string' && guid.trim().length > 0;
  });

  console.log(`✅ Valid codes with GUIDs: ${validCodes.length}\n`);

  // Count by type
  const typeCount: Record<string, number> = {};
  validCodes.forEach(row => {
    const type = row['IS Group/Formula'] || 'Unknown';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  console.log('📋 Breakdown by type:');
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`   • ${type}: ${count}`);
  });
  console.log();

  // Import financial codes
  console.log('💾 Importing financial codes...');
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of validCodes) {
    try {
      const guid = row['Code_GUID/'].trim();
      const nodeType = row['IS Group/Formula'] || 'Unknown';
      const isFormula = nodeType.toLowerCase().includes('formula');
      
      // Calculate depth
      let depth = 1;
      if (row.level2 > 0) depth = 2;
      if (row.level3 > 0) depth = 3;
      if (row.level4 > 0) depth = 4;

      await prisma.financialCode.upsert({
        where: { id: guid },
        create: {
          id: guid,
          code: row.Code.trim(),
          name: row.Name.trim(),
          nameEn: row['Name en']?.trim() || null,
          sign: (row.Sign || '+').trim(),
          nodeType,
          level1: row.level1 || 0,
          level2: row.level2 || 0,
          level3: row.level3 || 0,
          level4: row.level4 || 0,
          depth,
          appliesToPL: row.PL?.toString().toLowerCase() === 'yes' || row.PL?.toString() === '1',
          appliesToCF: row.CF?.toString().toLowerCase() === 'yes' || row.CF?.toString() === '1',
          isFormula,
          formulaExpression: row['Formula expression']?.trim() || null,
          category: row.Category?.trim() || null,
          customsCategory: row['Customs Category']?.trim() || null,
          orisAccount: row['Oris Account']?.trim() || null,
          validation: row.Validation?.trim() || null,
          orderDescription: row['Order description']?.trim() || null,
        },
        update: {
          code: row.Code.trim(),
          name: row.Name.trim(),
          nameEn: row['Name en']?.trim() || null,
          sign: (row.Sign || '+').trim(),
          nodeType,
          level1: row.level1 || 0,
          level2: row.level2 || 0,
          level3: row.level3 || 0,
          level4: row.level4 || 0,
          depth,
          appliesToPL: row.PL?.toString().toLowerCase() === 'yes' || row.PL?.toString() === '1',
          appliesToCF: row.CF?.toString().toLowerCase() === 'yes' || row.CF?.toString() === '1',
          isFormula,
          formulaExpression: row['Formula expression']?.trim() || null,
          category: row.Category?.trim() || null,
          customsCategory: row['Customs Category']?.trim() || null,
          orisAccount: row['Oris Account']?.trim() || null,
          validation: row.Validation?.trim() || null,
          orderDescription: row['Order description']?.trim() || null,
        },
      });

      imported++;
      
      // Progress indicator
      if (imported % 50 === 0) {
        console.log(`   Progress: ${imported}/${validCodes.length}`);
      }
    } catch (error: any) {
      skipped++;
      errors.push(`Code ${row.Code}: ${error.message}`);
    }
  }

  console.log(`✅ Imported: ${imported}`);
  if (skipped > 0) {
    console.log(`⚠️  Skipped: ${skipped}`);
    console.log('\nErrors:');
    errors.forEach(err => console.log(`   ${err}`));
  }
  console.log();

  // Build closure table (exclude Formula codes)
  console.log('🔗 Building closure table...');
  
  // Get all non-formula codes
  const allCodes = await prisma.financialCode.findMany({
    where: { isFormula: false },
    orderBy: [
      { level1: 'asc' },
      { level2: 'asc' },
      { level3: 'asc' },
      { level4: 'asc' },
    ],
  });

  console.log(`   Non-formula codes: ${allCodes.length}`);

  // Clear existing paths
  await prisma.financialCodePath.deleteMany();

  let pathsCreated = 0;

  // Create self-referencing paths (depth = 0)
  for (const code of allCodes) {
    await prisma.financialCodePath.create({
      data: {
        ancestorId: code.id,
        descendantId: code.id,
        depth: 0,
      },
    });
    pathsCreated++;
  }

  // Build hierarchy paths
  for (const descendant of allCodes) {
    // Find all ancestors for this code
    for (const ancestor of allCodes) {
      // Skip self (already added)
      if (ancestor.id === descendant.id) continue;

      // Check if ancestor is actually an ancestor
      let isAncestor = false;
      let depth = 0;

      if (
        ancestor.level1 === descendant.level1 &&
        ancestor.level2 === 0 &&
        descendant.depth > 1
      ) {
        // Level 1 ancestor
        isAncestor = true;
        depth = descendant.depth - 1;
      } else if (
        ancestor.level1 === descendant.level1 &&
        ancestor.level2 === descendant.level2 &&
        ancestor.level3 === 0 &&
        ancestor.level2 > 0 &&
        descendant.depth > 2
      ) {
        // Level 2 ancestor
        isAncestor = true;
        depth = descendant.depth - 2;
      } else if (
        ancestor.level1 === descendant.level1 &&
        ancestor.level2 === descendant.level2 &&
        ancestor.level3 === descendant.level3 &&
        ancestor.level4 === 0 &&
        ancestor.level3 > 0 &&
        descendant.depth > 3
      ) {
        // Level 3 ancestor
        isAncestor = true;
        depth = descendant.depth - 3;
      }

      if (isAncestor) {
        await prisma.financialCodePath.create({
          data: {
            ancestorId: ancestor.id,
            descendantId: descendant.id,
            depth,
          },
        });
        pathsCreated++;
      }
    }
  }

  console.log(`✅ Created ${pathsCreated} closure table paths\n`);

  // Verification
  console.log('📊 Verification:');
  const finalCount = await prisma.financialCode.count();
  const pathCount = await prisma.financialCodePath.count();
  const formulaCount = await prisma.financialCode.count({ where: { isFormula: true } });
  const addableCount = await prisma.financialCode.count({ where: { nodeType: 'Addable row' } });
  
  console.log(`   • Total financial codes: ${finalCount}`);
  console.log(`   • Formula codes (excluded from tree): ${formulaCount}`);
  console.log(`   • Addable rows (transaction targets): ${addableCount}`);
  console.log(`   • Closure table paths: ${pathCount}`);
  console.log();

  console.log('🎉 Import completed successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
