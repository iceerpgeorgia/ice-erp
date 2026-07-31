#!/usr/bin/env node
/**
 * Safe Prisma generation script that doesn't fail the build if generation fails
 * Used during Vercel deployments where file locking issues may occur
 */
const { execSync } = require('child_process');

try {
  console.log('[Prisma] Attempting to generate Prisma client...');
  execSync('pnpm exec prisma generate', { stdio: 'inherit' });
  console.log('[Prisma] ✓ Prisma client generated successfully');
} catch (error) {
  console.warn('[Prisma] ⚠ Prisma generation failed, but continuing build...');
  console.warn(`[Prisma] Error: ${error.message}`);
  // Don't throw - allow build to continue
  // The build will likely fail anyway if Prisma client is truly missing,
  // but this gives it a chance to work if the client was already cached
  process.exit(0);
}
