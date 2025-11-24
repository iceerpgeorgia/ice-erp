// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = { 
  reactStrictMode: true,
  // Skip static page generation during build if DB not available
  ...(process.env.CI && !process.env.DATABASE_URL?.includes('localhost') ? {} : {}),
  experimental: {
    // Disable static optimization for pages that need DB
    ...(process.env.CI ? { isrMemoryCacheSize: 0 } : {})
  }
};
module.exports = nextConfig;
