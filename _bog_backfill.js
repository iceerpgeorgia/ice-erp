#!/usr/bin/env node
/**
 * BOG Bank Transaction Backfill
 * Fills missing transaction data for specified date range (default: last 30 days)
 * 
 * Usage:
 *   node _bog_backfill.js                    # Last 30 days
 *   node _bog_backfill.js 60                 # Last 60 days
 *   node _bog_backfill.js --start 2026-06-01 --end 2026-07-31
 */

require('dotenv').config({ path: '.env.local' });
const path = require('path');

async function runBackfill() {
  try {
    const args = process.argv.slice(2);
    
    let daysBack = 30;
    let startDate = null;
    let endDate = null;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--start' && args[i + 1]) {
        startDate = args[i + 1];
        i++;
      } else if (args[i] === '--end' && args[i + 1]) {
        endDate = args[i + 1];
        i++;
      } else if (!isNaN(parseInt(args[i]))) {
        daysBack = parseInt(args[i]);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('🚀 BOG BANK TRANSACTION BACKFILL');
    console.log('='.repeat(100) + '\n');

    // Check configuration
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const bogCredentials = (process.env.BOG_CREDENTIALS_MAP || '').trim();
    
    console.log('📋 Configuration Check:\n');
    console.log(`✓ CRON_SECRET: ${cronSecret ? '✓ SET' : '✗ MISSING'}`);
    console.log(`✓ BOG_CREDENTIALS_MAP: ${bogCredentials ? `✓ SET (${bogCredentials.length} chars)` : '✗ EMPTY'}`);
    console.log(`✓ BOG_CLIENT_ID: ${process.env.BOG_CLIENT_ID ? '✓ SET' : '✗ NOT SET'}`);
    console.log(`✓ BOG_ACCESS_TOKEN: ${process.env.BOG_ACCESS_TOKEN ? '✓ SET' : '✗ NOT SET'}`);
    console.log();

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured in .env.local');
      process.exit(1);
    }

    if (!bogCredentials && !process.env.BOG_CLIENT_ID && !process.env.BOG_ACCESS_TOKEN) {
      console.error('❌ BOG credentials not configured.');
      console.error('   Set one of:');
      console.error('   - BOG_CREDENTIALS_MAP (JSON array with insiderUuid + accessToken/clientId)');
      console.error('   - BOG_CLIENT_ID + BOG_CLIENT_SECRET');
      console.error('   - BOG_ACCESS_TOKEN');
      console.error('\n   See AGENTS.md section "BOG GEL Bank Statement Processing" for details.');
      process.exit(1);
    }

    // Prepare request payload
    const payload = {};
    if (startDate && endDate) {
      payload.startDate = startDate;
      payload.endDate = endDate;
      console.log(`📅 Date Range: ${startDate} → ${endDate}\n`);
    } else {
      payload.daysBack = daysBack;
      console.log(`📅 Lookback Period: Last ${daysBack} days\n`);
    }

    // Trigger backfill
    console.log('⏳ Triggering backfill endpoint...\n');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/cron/bog-import-backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Display results
    console.log('📊 BACKFILL RESULTS:\n');

    if (result.ok) {
      console.log('✅ SUCCESS\n');
      console.log(`   Total transactions imported: ${result.totalTransactions.toLocaleString()}`);
      console.log(`   Successful days: ${result.successDays}`);
      console.log(`   Failed days: ${result.failedDays}`);
      console.log(`   Period: ${result.period.startYmd} → ${result.period.endYmd}\n`);

      if (result.successes && result.successes.length > 0) {
        console.log('   Sample imports:');
        result.successes.slice(0, 5).forEach((s) => {
          console.log(`   • ${s.accountNumber} (${s.currencyCode}) on ${s.date}: ${s.detailsCount} txns`);
        });
        if (result.successes.length > 5) {
          console.log(`   ... and ${result.successes.length - 5} more days`);
        }
      }
    } else {
      console.log('❌ FAILED\n');
      console.log(`   Error: ${result.error}`);
      console.log(`   Message: ${result.message || 'N/A'}`);

      if (result.config) {
        console.log('\n   Current Configuration:');
        console.log(`   • Has Credentials Map: ${result.config.hasCredentialsMap}`);
        console.log(`   • Has Client ID: ${result.config.hasClientId}`);
        console.log(`   • Has Static Token: ${result.config.hasStaticAccessToken}`);
      }
    }

    if (result.failures && result.failures.length > 0) {
      console.log('\n   Failed attempts:');
      result.failures.slice(0, 3).forEach((f) => {
        console.log(`   ⚠️  ${f.accountNumber}: ${f.reason}`);
      });
    }

    console.log('\n' + '='.repeat(100));
    console.log(result.ok ? '✅ Backfill completed successfully' : '❌ Backfill encountered errors');
    console.log('='.repeat(100) + '\n');

    process.exit(result.ok ? 0 : 1);

  } catch (error) {
    console.error('\n❌ FATAL ERROR\n');
    console.error(error.message);
    process.exit(1);
  }
}

runBackfill();
