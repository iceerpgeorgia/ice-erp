#!/usr/bin/env node
/**
 * Vercel build script - simplified version that just runs Next.js build
 * Prisma client should be generated during pnpm install postinstall hook
 */
const { execSync } = require('child_process');

function log(msg) {
  console.log(`[vercel-build] ${msg}`);
}

try {
  log('Starting Next.js build...');
  
  // Run Next.js build directly
  execSync('next build', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  log('✓ Build completed successfully!');
  process.exit(0);
} catch (error) {
  log(`✗ Build failed: ${error.message}`);
  process.exit(1);
}
