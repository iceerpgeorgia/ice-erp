const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Fetches exchange rates from National Bank of Georgia API
 * API Documentation: https://nbg.gov.ge/en/monetary-policy/currency
 * @param {Date} date - Date to fetch rates for
 * @returns {Promise<Object>} Exchange rates for the given date
 */
async function fetchNBGRates(date) {
  const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // NBG API endpoint for commercial rate
  const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${dateStr}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NBG API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data[0] || !data[0].currencies) {
      console.log(`No data available for ${dateStr}`);
      return null;
    }
    
    // Extract rates for specific currencies
    const currencies = data[0].currencies;
    const rates = {};
    
    for (const curr of currencies) {
      const code = curr.code?.toUpperCase();
      const rate = curr.rate ? parseFloat(curr.rate) : null;
      
      if (code && rate) {
        switch (code) {
          case 'USD':
            rates.usd_rate = rate;
            break;
          case 'EUR':
            rates.eur_rate = rate;
            break;
          case 'CNY':
            rates.cny_rate = rate;
            break;
          case 'GBP':
            rates.gbp_rate = rate;
            break;
          case 'RUB':
            rates.rub_rate = rate;
            break;
          case 'TRY':
            rates.try_rate = rate;
            break;
          case 'AED':
            rates.aed_rate = rate;
            break;
          case 'KZT':
            rates.kzt_rate = rate;
            break;
        }
      }
    }
    
    return Object.keys(rates).length > 0 ? rates : null;
  } catch (error) {
    console.error(`Error fetching rates for ${dateStr}:`, error.message);
    return null;
  }
}

/**
 * Finds all missing dates in the exchange rates table
 * @param {Date} startDate - Start date to check from
 * @param {Date} endDate - End date to check until
 * @returns {Promise<Date[]>} Array of missing dates
 */
async function findMissingDates(startDate, endDate) {
  const result = await prisma.$queryRaw`
    WITH date_series AS (
      SELECT generate_series(
        ${startDate}::date,
        ${endDate}::date,
        interval '1 day'
      )::date AS expected_date
    )
    SELECT expected_date
    FROM date_series
    LEFT JOIN nbg_exchange_rates ON date_series.expected_date = nbg_exchange_rates.date
    WHERE nbg_exchange_rates.date IS NULL
    ORDER BY expected_date
  `;
  
  return result.map(row => new Date(row.expected_date));
}

/**
 * Imports exchange rates for a specific date
 * @param {Date} date - Date to import rates for
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function importRateForDate(date) {
  const dateStr = date.toISOString().split('T')[0];
  
  // Check if already exists
  const existing = await prisma.nbg_exchange_rates.findUnique({
    where: { date: date }
  });
  
  if (existing) {
    console.log(`✓ Rates for ${dateStr} already exist`);
    return true;
  }
  
  const rates = await fetchNBGRates(date);
  
  if (!rates) {
    console.log(`✗ No rates available for ${dateStr} (weekend or holiday)`);
    return false;
  }
  
  try {
    await prisma.nbg_exchange_rates.create({
      data: {
        date: date,
        updated_at: new Date(),
        ...rates
      }
    });
    console.log(`✓ Imported rates for ${dateStr}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to import rates for ${dateStr}:`, error.message);
    return false;
  }
}

/**
 * Backfills missing exchange rates
 */
async function backfillMissingRates() {
  console.log('🔍 Finding missing dates...');
  
  // Get date range from existing data
  const result = await prisma.$queryRaw`
    SELECT MIN(date) as min_date, MAX(date) as max_date 
    FROM nbg_exchange_rates
  `;
  
  const startDate = result[0].min_date || new Date('2011-01-01');
  const endDate = new Date(); // Today
  
  const missingDates = await findMissingDates(startDate, endDate);
  
  if (missingDates.length === 0) {
    console.log('✓ No missing dates found!');
    return;
  }
  
  console.log(`📅 Found ${missingDates.length} missing dates`);
  console.log('🔄 Starting backfill...\n');
  
  let imported = 0;
  let skipped = 0;
  
  for (const date of missingDates) {
    const success = await importRateForDate(date);
    if (success) imported++;
    else skipped++;
    
    // Small delay to be respectful to NBG API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n✅ Backfill complete: ${imported} imported, ${skipped} skipped`);
}

/**
 * Imports today's exchange rates
 */
async function importTodayRates() {
  console.log('📊 Importing today\'s exchange rates...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const success = await importRateForDate(today);
  
  if (success) {
    console.log('✅ Today\'s rates imported successfully');
  } else {
    console.log('ℹ️  Today\'s rates not available yet');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'backfill') {
      await backfillMissingRates();
    } else if (command === 'today') {
      await importTodayRates();
    } else {
      // Default: import today's rates
      await importTodayRates();
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchNBGRates, importRateForDate, backfillMissingRates, importTodayRates };
