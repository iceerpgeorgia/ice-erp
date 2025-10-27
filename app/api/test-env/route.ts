import { NextResponse } from 'next/server';

export async function GET() {
  // Test endpoint to check if environment variables are available
  const envVars = {
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    // Show first 10 chars of each to verify they exist without exposing secrets
    nextAuthUrlPrefix: process.env.NEXTAUTH_URL?.substring(0, 10),
    googleClientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10),
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('GOOGLE') || key.includes('NEXTAUTH') || key.includes('DATABASE')
    ),
  };

  return NextResponse.json(envVars);
}
