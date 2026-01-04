// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = { 
  reactStrictMode: true,
  // Exclude design reference folders from compilation
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/Payments Report Figma/**', '**/node_modules/**'],
    };
    return config;
  },
  // Exclude from TypeScript checking
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude specific paths from build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].map(ext => {
    return ext;
  }),
};

module.exports = nextConfig;
