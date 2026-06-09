#!/usr/bin/env node
/**
 * Vercel build script that handles Prisma client generation and Next.js build
 * with proper error handling and logging
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '✗' : level === 'warn' ? '⚠' : '✓';
  console.log(`[${timestamp}] ${prefix} ${msg}`);
}

async function build() {
  try {
    log('Starting Vercel build process...');
    
    // Step 1: Try to ensure Prisma client is generated
    log('Ensuring Prisma client is available...');
    try {
      // Check if Prisma client already exists
      const prismaClientPath = path.join(process.cwd(), 'node_modules', '@prisma', 'client');
      if (!fs.existsSync(prismaClientPath)) {
        log('Prisma client not found, attempting to generate...');
        execSync('pnpm exec prisma generate', { stdio: 'inherit' });
        log('Prisma client generated successfully');
      } else {
        log('Prisma client found in cache');
      }
    } catch (err) {
      log(`Prisma generation failed: ${err.message}`, 'warn');
      log('Continuing with build - Prisma client may be from cache', 'warn');
    }
    
    // Step 2: Run Next.js build
    log('Building Next.js application...');
    execSync('pnpm exec next build', { stdio: 'inherit' });
    log('Build completed successfully!');
    
    process.exit(0);
  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

build();
