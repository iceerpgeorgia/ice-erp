#!/usr/bin/env node
/**
 * Prisma generation script with retry logic and environment configuration
 * Handles transient failures that might occur in CI/build environments
 */
const { execSync } = require('child_process');

// Set environment variables to help Prisma generation
process.env.PRISMA_SKIP_VALIDATION = 'true';
process.env.SKIP_ENV_VALIDATION = 'true';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generatePrisma(attemptNumber = 1) {
  try {
    console.log(`[prisma-generate] Attempt ${attemptNumber}/${MAX_RETRIES}: Generating Prisma client...`);
    // Use npx to ensure we run from node_modules
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      timeout: 60000, // 60 second timeout
      env: {
        ...process.env,
        PRISMA_SKIP_VALIDATION: 'true',
        SKIP_ENV_VALIDATION: 'true'
      }
    });
    console.log(`[prisma-generate] ✓ Successfully generated Prisma client`);
    return true;
  } catch (error) {
    if (attemptNumber < MAX_RETRIES) {
      console.warn(`[prisma-generate] ⚠ Attempt ${attemptNumber} failed: ${error.message}`);
      console.log(`[prisma-generate] Waiting ${RETRY_DELAY_MS}ms before retry...`);
      await sleep(RETRY_DELAY_MS);
      return generatePrisma(attemptNumber + 1);
    } else {
      console.warn(`[prisma-generate] ✗ All ${MAX_RETRIES} attempts failed after ${(MAX_RETRIES * RETRY_DELAY_MS) / 1000}s`);
      console.warn(`[prisma-generate] Last error: ${error.message}`);
      // Don't fail postinstall - next build will determine if Prisma is essential
      console.warn(`[prisma-generate] ⓘ Continuing with build...`);
      return false;
    }
  }
}

async function deployMigrations() {
  try {
    console.log(`[prisma-migrate] Deploying database migrations...`);
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout for migrations
      env: {
        ...process.env,
        PRISMA_SKIP_VALIDATION: 'true',
        SKIP_ENV_VALIDATION: 'true'
      }
    });
    console.log(`[prisma-migrate] ✓ Successfully deployed migrations`);
    return true;
  } catch (error) {
    console.warn(`[prisma-migrate] ⚠ Migration deployment failed: ${error.message}`);
    console.warn(`[prisma-migrate] ⓘ Continuing with build (migrations may need manual deployment)...`);
    return false;
  }
}

generatePrisma().then(async (success) => {
  if (success) {
    // If Prisma client generation succeeded, try to deploy migrations
    await deployMigrations();
  }
  process.exit(0);
}).catch(err => {
  console.error('[prisma-generate] Unexpected error:', err);
  process.exit(0); // Don't fail postinstall
});
