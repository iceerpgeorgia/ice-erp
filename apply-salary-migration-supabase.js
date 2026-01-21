const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

async function createSalaryAccrualsTable() {
  const client = await pool.connect();
  try {
    console.log("Creating salary_accruals table...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.salary_accruals (
        id BIGSERIAL PRIMARY KEY,
        uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        counteragent_uuid UUID NOT NULL,
        financial_code_uuid UUID NOT NULL,
        nominal_currency_uuid UUID NOT NULL,
        payment_id VARCHAR(100) NOT NULL,
        salary_month DATE NOT NULL,
        net_sum DECIMAL(15, 2) NOT NULL DEFAULT 0,
        surplus_insurance DECIMAL(15, 2),
        deducted_insurance DECIMAL(15, 2),
        deducted_fitness DECIMAL(15, 2),
        deducted_fine DECIMAL(15, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255) NOT NULL,
        updated_by VARCHAR(255) NOT NULL
      );
    `);

    console.log("Creating indexes...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_counteragent 
        ON public.salary_accruals(counteragent_uuid);
      
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_financial_code 
        ON public.salary_accruals(financial_code_uuid);
      
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_salary_month 
        ON public.salary_accruals(salary_month);
      
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_payment_id 
        ON public.salary_accruals(payment_id);
      
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_nominal_currency 
        ON public.salary_accruals(nominal_currency_uuid);
      
      CREATE INDEX IF NOT EXISTS idx_salary_accruals_month_counteragent 
        ON public.salary_accruals(salary_month, counteragent_uuid);
    `);

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createSalaryAccrualsTable();
