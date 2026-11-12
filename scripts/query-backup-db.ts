#!/usr/bin/env node
/**
 * Direct GCP Backup Database Query Tool
 * Usage: npx ts-node scripts/query-backup-db.ts
 *
 * Prompts for connection details, then queries restored Alliance Highline data.
 */

import * as readline from 'readline';
import { Client } from 'pg';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('\n🔗 GCP Backup Database Query Tool');
  console.log('==================================\n');

  // Prompt for connection details
  const host = await prompt('Database Host (IP or hostname): ');
  const database = await prompt('Database Name (usually "postgres"): ');
  const user = await prompt('Username (usually "postgres"): ');
  const password = await prompt('Password: ');
  const port = await prompt('Port (default 5432): ');

  const pgPort = port ? parseInt(port, 10) : 5432;

  console.log('\n⏳ Connecting to database...\n');

  const client = new Client({
    host,
    port: pgPort,
    database,
    user,
    password,
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Query 1: Orphaned cost payments (payment_id = NULL)
    console.log('📊 QUERY 1: Orphaned Cost Payments\n');
    const orphanedResult = await client.query(`
      SELECT 
        p.uuid,
        p.counteragent_uuid,
        p.project_uuid,
        p.financial_code_uuid,
        p.currency_uuid,
        p.payment_id,
        p.waybill_derived,
        fc.code as financial_code,
        c.name as counteragent_name,
        cur.code as currency_code
      FROM payments p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN counteragents c ON p.counteragent_uuid = c.uuid
      LEFT JOIN currencies cur ON p.currency_uuid = cur.uuid
      WHERE p.project_uuid = '${process.argv[2] || 'dc975886-9bf9-42c8-afbe-87695aa01262'}'
        AND p.waybill_derived = TRUE
        AND p.payment_id IS NULL
      ORDER BY p.created_at DESC;
    `);

    console.log(`Found: ${orphanedResult.rows.length} orphaned cost payments\n`);
    console.log(JSON.stringify(orphanedResult.rows, null, 2));

    // Query 2: Associated waybills for matching
    console.log('\n\n📊 QUERY 2: Waybill Source Data for Matching\n');
    const waybillResult = await client.query(`
      SELECT 
        w.uuid,
        w.rs_id,
        w.counteragent_uuid,
        w.project_uuid,
        w.financial_code_uuid,
        w.sum,
        w.currency_uuid,
        c.name as counteragent_name,
        fc.code as financial_code,
        cur.code as currency_code,
        w.created_at
      FROM rs_waybills_in_api w
      LEFT JOIN counteragents c ON w.counteragent_uuid = c.uuid
      LEFT JOIN financial_codes fc ON w.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON w.currency_uuid = cur.uuid
      WHERE w.project_uuid = '${process.argv[2] || 'dc975886-9bf9-42c8-afbe-87695aa01262'}'
      ORDER BY c.uuid, fc.uuid, w.created_at;
    `);

    console.log(`Found: ${waybillResult.rows.length} waybills for matching\n`);
    console.log(JSON.stringify(waybillResult.rows, null, 2));

    // Query 3: Export to CSV format
    console.log('\n\n📥 CSV EXPORT FORMAT\n');
    console.log('ORPHANED PAYMENTS CSV:');
    console.log('uuid,counteragent_uuid,financial_code_uuid,currency_uuid,financial_code,counteragent_name');
    orphanedResult.rows.forEach((row) => {
      console.log(
        `${row.uuid},${row.counteragent_uuid},${row.financial_code_uuid},${row.currency_uuid},${row.financial_code},${row.counteragent_name}`
      );
    });

    console.log('\n\nWAYBILL MATCHING CSV:');
    console.log('uuid,rs_id,counteragent_uuid,financial_code_uuid,currency_uuid,sum,financial_code,counteragent_name');
    waybillResult.rows.forEach((row) => {
      console.log(
        `${row.uuid},${row.rs_id},${row.counteragent_uuid},${row.financial_code_uuid},${row.currency_uuid},${row.sum},${row.financial_code},${row.counteragent_name}`
      );
    });

    console.log('\n✅ Export complete!\n');
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    process.exit(1);
  } finally {
    await client.end();
    rl.close();
  }
}

main().catch(console.error);
