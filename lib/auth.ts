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
      /** DEV ONLY: uncomment if you want to allow linking by email automatically
       *  (security risk in production).
       */
      // allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { 
    strategy: "database",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      // Check if email is in authorized list (for pre-authorization)
      const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(',').map(e => e.trim()) || [];
      const isPreAuthorized = authorizedEmails.includes(user.email);

      // For pre-authorized users, allow sign-in and let adapter handle user creation
      // We'll update authorization in the session callback after user is created
      if (isPreAuthorized) {
        return true;
      }

      // Check if user already exists in database
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // If user exists, check authorization
      if (existingUser) {
        if (!existingUser.isAuthorized) {
          return '/auth/unauthorized';
        }
        return true;
      }

      // New users who are not pre-authorized need manual authorization
      return '/auth/unauthorized';
    },
    async session({ session, user }) {
      if (session?.user) {
        session.user.id = user.id;
        session.user.role = (user as any).role || 'user';
        session.user.isAuthorized = (user as any).isAuthorized || false;

        // Auto-authorize pre-authorized users on first session load
        const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(',').map(e => e.trim()) || [];
        const isPreAuthorized = user.email && authorizedEmails.includes(user.email);
        
        if (isPreAuthorized && !(user as any).isAuthorized) {
          // Update user to authorized if they're in the pre-authorized list
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isAuthorized: true,
              role: 'system_admin',
              authorizedAt: new Date(),
              authorizedBy: 'system',
            },
          });
          session.user.isAuthorized = true;
          session.user.role = 'system_admin';
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=',
};
