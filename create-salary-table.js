const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createTableWithPrisma() {
  try {
    console.log("Creating salary_accruals table using Prisma...\n");
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS salary_accruals (
        id BIGSERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        
        -- References
        counteragent_uuid UUID NOT NULL,
        financial_code_uuid UUID NOT NULL,
        nominal_currency_uuid UUID NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        
        -- Period
        salary_month DATE NOT NULL,
        
        -- Amounts
        net_sum DECIMAL(15, 2) NOT NULL DEFAULT 0,
        surplus_insurance DECIMAL(15, 2),
        deducted_insurance DECIMAL(15, 2),
        deducted_fitness DECIMAL(15, 2),
        deducted_fine DECIMAL(15, 2),
        
        -- Audit
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255) NOT NULL,
        updated_by VARCHAR(255) NOT NULL
      );
    `;

    console.log("✅ Table created successfully!");
    console.log("\nCreating indexes...");

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_counteragent ON salary_accruals(counteragent_uuid);`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_financial_code ON salary_accruals(financial_code_uuid);`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_salary_month ON salary_accruals(salary_month);`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_payment_id ON salary_accruals(payment_id);`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_currency ON salary_accruals(nominal_currency_uuid);`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_salary_accruals_month_counteragent ON salary_accruals(salary_month, counteragent_uuid);`;

    console.log("✅ Indexes created successfully!");

    // Verify
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'salary_accruals'
      ORDER BY ordinal_position;
    `;

    console.log("\n📊 Table structure:");
    console.log('Column Name                 | Type              | Nullable');
    console.log('-'.repeat(70));
    
    result.forEach(row => {
      console.log(
        `${String(row.column_name).padEnd(28)}| ${String(row.data_type).padEnd(18)}| ${row.is_nullable}`
      );
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTableWithPrisma();
