#!/usr/bin/env node
/**
 * Prisma generation script with retry logic
 * Handles transient failures that might occur in CI/build environments
 */
const { execSync } = require('child_process');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generatePrisma(attemptNumber = 1) {
  try {
    console.log(`[prisma-generate] Attempt ${attemptNumber}/${MAX_RETRIES}: Generating Prisma client...`);
    // Use prisma CLI directly instead of pnpm exec
    execSync('prisma generate', { 
      stdio: 'inherit',
      timeout: 60000 // 60 second timeout
    });
    console.log(`[prisma-generate] ✓ Successfully generated Prisma client`);
    return true;
  } catch (error) {
    if (attemptNumber < MAX_RETRIES) {
      console.warn(`[prisma-generate] ⚠ Attempt ${attemptNumber} failed: ${error.message}`);
      console.log(`[prisma-generate] Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS);
      return generatePrisma(attemptNumber + 1);
    } else {
      console.warn(`[prisma-generate] ✗ All ${MAX_RETRIES} attempts failed`);
      console.warn(`[prisma-generate] Error: ${error.message}`);
      // Don't fail postinstall - continue and let next build determine if Prisma is needed
      console.warn(`[prisma-generate] Continuing despite failure...`);
      return false;
    }
  }
}

generatePrisma().then(() => {
  process.exit(0);
});
