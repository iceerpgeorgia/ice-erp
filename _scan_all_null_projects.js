const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAllNullProjectIssues() {
  console.log('=== SCANNING ALL BANK TABLES FOR NULL PROJECT_UUID ISSUES ===\n');
  
  // Only the tables that actually exist (from AGENTS.md)
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
    'GE78BG0000000893486000_BOG_USD',
    'GE78BG0000000893486000_BOG_EUR',
    'GE78BG0000000893486000_BOG_AED',
    'GE78BG0000000893486000_BOG_GBP',
    'GE78BG0000000893486000_BOG_KZT',
    'GE78BG0000000893486000_BOG_CNY',
    'GE78BG0000000893486000_BOG_TRY',
  ];
  
  let totalIssues = 0;
  const issuesByTable = {};
  
  for (const table of tables) {
    try {
      // Find transactions with NULL project_uuid but WITH a payment record
      const issues = await prisma.$queryRawUnsafe(`
        SELECT 
          t.uuid,
          t.payment_id,
          t.project_uuid,
          t.financial_code_uuid,
          p.project_uuid as payment_project_uuid,
          p.financial_code_uuid as payment_fc_uuid,
          fc.is_income
        FROM "${table}" t
        LEFT JOIN payments p ON t.payment_id = p.payment_id
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        WHERE t.project_uuid IS NULL
          AND p.payment_id IS NOT NULL
          AND p.project_uuid IS NOT NULL
      `);
      
      if (issues.length > 0) {
        issuesByTable[table] = issues;
        totalIssues += issues.length;
        console.log(`${table}: ${issues.length} issues found`);
        
        // Show breakdown by income
        const income = issues.filter(i => i.is_income).length;
        const expense = issues.length - income;
        console.log(`  - Income: ${income}, Expense: ${expense}\n`);
      }
    } catch (err) {
      // Table doesn't exist, skip
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total issues across all tables: ${totalIssues}`);
  console.log(`Tables affected: ${Object.keys(issuesByTable).length}\n`);
  
  if (totalIssues > 0) {
    console.log('Issues by table:');
    for (const [table, issues] of Object.entries(issuesByTable)) {
      console.log(`  ${table}: ${issues.length}`);
    }
    
    console.log(`\nThese ${totalIssues} transactions have their project_uuid set in the payments table`);
    console.log('but NOT in the bank transaction tables, causing them to be filtered out.');
  }
  
  await prisma.$disconnect();
  
  return issuesByTable;
}

findAllNullProjectIssues().catch(console.error);
