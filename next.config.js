// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = { 
  reactStrictMode: true,
  // Explicitly expose environment variables to the app
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTHORIZED_EMAILS: process.env.AUTHORIZED_EMAILS,
    DATABASE_URL: process.env.DATABASE_URL,
  },
};
module.exports = nextConfig;
