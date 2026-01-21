const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkTableSchema() {
  try {
    console.log("Checking salary_accruals table schema...\n");
    
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'salary_accruals'
      ORDER BY ordinal_position;
    `;

    console.log("Current schema:");
    console.log('Column Name                 | Type              | Nullable | Default');
    console.log('-'.repeat(80));
    
    result.forEach(row => {
      console.log(
        `${String(row.column_name).padEnd(28)}| ${String(row.data_type).padEnd(18)}| ${String(row.is_nullable).padEnd(9)}| ${row.column_default || ''}`
      );
    });

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableSchema();
