// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = { 
  reactStrictMode: true,
  // Security headers applied to every response. CSP is intentionally omitted here
  // to avoid breaking inline styles/scripts; add it separately after testing.
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Exclude design reference folders from compilation
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (!Array.isArray(config.externals)) {
        config.externals = config.externals ? [config.externals] : [];
      }
      config.externals.push({ pdfkit: 'commonjs pdfkit' });
    }

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

module.exports = withBundleAnalyzer(nextConfig);
