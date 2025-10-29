// lib/auth.ts (NextAuth v4)
import { PrismaClient } from "@prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

declare global {
  // avoid re-creating Prisma in dev HMR
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// Validate environment variables at module load
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  console.error('[auth] Missing Google OAuth credentials:', {
    hasClientId: !!googleClientId,
    hasClientSecret: !!googleClientSecret,
    clientIdLength: googleClientId?.length || 0,
    secretLength: googleClientSecret?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
      allowDangerousEmailAccountLinking: true, // Allow linking Google account to existing email
    }),
  ],
  session: { 
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        console.log('[auth] signIn callback:', { email: user.email, hasAccount: !!account });
        
        if (!user.email) {
          console.log('[auth] signIn: No email, rejecting');
          return false;
        }

        // Check if user exists in database (must be manually added by admin)
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        console.log('[auth] signIn: User check:', { 
          exists: !!existingUser, 
          isAuthorized: existingUser?.isAuthorized 
        });

        // Only allow users that exist in database and are authorized
        if (!existingUser) {
          console.log('[auth] signIn: User does not exist in database, rejecting');
          return '/auth/unauthorized';
        }

        if (!existingUser.isAuthorized) {
          console.log('[auth] signIn: User not authorized, rejecting');
          return '/auth/unauthorized';
        }

        // Allow sign-in - Prisma adapter will link the OAuth account automatically
        console.log('[auth] signIn: User authorized, allowing');
        return true;
      } catch (error) {
        console.error('[auth] signIn callback error:', error);
        return false;
      }
    },
    async session({ session, user }) {
      try {
        console.log('[auth] session callback:', { userId: user.id, email: user.email });
        
        if (session?.user) {
          session.user.id = user.id;
          session.user.role = (user as any).role || 'user';
          session.user.isAuthorized = (user as any).isAuthorized || false;
        }
        return session;
      } catch (error) {
        console.error('[auth] session callback error:', error);
        return session;
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=',
};
