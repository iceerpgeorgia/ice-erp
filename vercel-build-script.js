const { execSync } = require('child_process');

console.log('Running Prisma generate...');
execSync('pnpm prisma generate', { stdio: 'inherit' });

console.log('Running Prisma migrate deploy...');
try {
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });
} catch (error) {
  console.log('Warning: Migration deploy failed (may be expected if migrations already applied)');
  console.log('Continuing with build...');
}

console.log('Running Next.js build...');
execSync('pnpm exec next build', { stdio: 'inherit' });

console.log('Build completed successfully!');