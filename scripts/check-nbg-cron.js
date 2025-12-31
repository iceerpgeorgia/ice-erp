#!/usr/bin/env node
/**
 * Check NBG rates cron job status and configuration
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNBGRates() {
  console.log('🔍 Checking NBG Exchange Rates Status\n');
  console.log('='.repeat(60));

  try {
    // 1. Check latest rate in database
    console.log('\n📊 Latest rate in database:');
    const latestRate = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true, usdRate: true, eurRate: true }
    });

    if (latestRate) {
      const daysOld = Math.floor((Date.now() - latestRate.date.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   Date: ${latestRate.date.toISOString().split('T')[0]}`);
      console.log(`   USD Rate: ${latestRate.usdRate}`);
      console.log(`   EUR Rate: ${latestRate.eurRate}`);
      console.log(`   Age: ${daysOld} days old`);
      
      if (daysOld > 2) {
        console.log(`   ⚠️  WARNING: Rates are ${daysOld} days old - cron may not be running!`);
      } else {
        console.log('   ✅ Rates are recent');
      }
    } else {
      console.log('   ❌ No rates found in database!');
    }

    // 2. Check total count
    console.log('\n📈 Total rates:');
    const totalCount = await prisma.nBGExchangeRate.count();
    console.log(`   ${totalCount} rate records`);

    // 3. Check environment configuration
    console.log('\n🔧 Configuration:');
    console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ NOT SET'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ NOT SET'}`);

    // 4. Check vercel.json cron config
    const fs = require('fs');
    const path = require('path');
    const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
    
    if (fs.existsSync(vercelJsonPath)) {
      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      console.log('\n⏰ Vercel Cron Configuration:');
      if (vercelConfig.crons && vercelConfig.crons.length > 0) {
        vercelConfig.crons.forEach(cron => {
          if (cron.path.includes('nbg')) {
            console.log(`   ✅ Configured: ${cron.path}`);
            console.log(`   Schedule: ${cron.schedule} (every hour)`);
          }
        });
      } else {
        console.log('   ❌ No cron jobs configured!');
      }
    }

    // 5. Test NBG API accessibility
    console.log('\n🌐 Testing NBG API:');
    const NBG_API_URL = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/";
    
    try {
      const response = await fetch(NBG_API_URL);
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ NBG API is accessible`);
        console.log(`   Latest available date: ${data[0]?.date || 'unknown'}`);
      } else {
        console.log(`   ❌ NBG API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Cannot reach NBG API: ${error.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSIS:');
    
    if (!process.env.CRON_SECRET) {
      console.log('\n❌ ISSUE: CRON_SECRET not set');
      console.log('   The cron job is failing authentication checks');
      console.log('\n🔧 FIX:');
      console.log('   1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
      console.log('   2. Add: CRON_SECRET = <random-secret-string>');
      console.log('   3. Redeploy the project');
    } else if (latestRate && Math.floor((Date.now() - latestRate.date.getTime()) / (1000 * 60 * 60 * 24)) > 2) {
      console.log('\n⚠️  ISSUE: Rates are outdated but CRON_SECRET is set');
      console.log('   The cron job may not be triggering');
      console.log('\n🔧 FIX:');
      console.log('   1. Check Vercel Dashboard → Your Project → Functions → Cron Jobs');
      console.log('   2. Verify the cron job is enabled');
      console.log('   3. Check recent logs for errors');
      console.log('   4. Manually trigger: curl https://iceerpgeorgia.com/api/cron/update-nbg-rates \\');
      console.log('      -H "Authorization: Bearer YOUR_CRON_SECRET"');
    } else {
      console.log('\n✅ Everything looks good!');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkNBGRates();
