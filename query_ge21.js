#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

// Load env from .env.production.local
require('dotenv').config({ path: path.join(__dirname, '.env.production.local') });

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('No DATABASE_URL or DIRECT_DATABASE_URL set');
  process.exit(1);
}

// Extract connection info from URL
const url = new URL(dbUrl);
const host = url.hostname;
const port = url.port || 5432;
const user = url.username;
const password = url.password;
const database = url.pathname.slice(1);

console.log('Connecting to:', host, 'database:', database);

// Query 1: Check GE21 account
const queries = [
  `SELECT uuid, account_number, raw_table_name, is_active, insider_uuid, currency_uuid FROM bank_accounts WHERE account_number = 'GE21BG0000000611354669';`,
  `SELECT COUNT(*) as count FROM "GE21BG0000000611354669_BOG_GEL";`,
  `SELECT COUNT(*) as total_banks FROM bank_accounts WHERE is_active = true;`,
  `SELECT raw_table_name, COUNT(*) as rows FROM "GE21BG0000000611354669_BOG_GEL" GROUP BY raw_table_name LIMIT 1;`
];

// Execute each query
queries.forEach((query, idx) => {
  const psqlCmd = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -c "${query.replace(/"/g, '\\"')}"`;
  
  exec(psqlCmd, (error, stdout, stderr) => {
    console.log(`\n=== Query ${idx + 1} ===`);
    if (error) {
      console.error('Error:', stderr);
    } else {
      console.log(stdout);
    }
  });
});
