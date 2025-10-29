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
      try {
        console.log('[auth] signIn callback:', { email: user.email, hasAccount: !!account });
        
        if (!user.email) {
          console.log('[auth] signIn: No email, rejecting');
          return false;
        }

        // Check if email is in authorized list (for pre-authorization)
        const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(',').map(e => e.trim()) || [];
        const isPreAuthorized = authorizedEmails.includes(user.email);

        console.log('[auth] signIn: Pre-auth check:', { email: user.email, isPreAuthorized, authorizedEmails });

        // For pre-authorized users, allow sign-in and let adapter handle user creation
        // We'll update authorization in the session callback after user is created
        if (isPreAuthorized) {
          console.log('[auth] signIn: Pre-authorized, allowing');
          return true;
        }

        // Check if user already exists in database
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        console.log('[auth] signIn: Existing user check:', { exists: !!existingUser, isAuthorized: existingUser?.isAuthorized });

        // If user exists, check authorization
        if (existingUser) {
          if (!existingUser.isAuthorized) {
            console.log('[auth] signIn: User exists but not authorized, redirecting');
            return '/auth/unauthorized';
          }
          console.log('[auth] signIn: User authorized, allowing');
          return true;
        }

        // New users who are not pre-authorized need manual authorization
        console.log('[auth] signIn: New user not pre-authorized, redirecting');
        return '/auth/unauthorized';
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

          // Auto-authorize pre-authorized users on first session load
          const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(',').map(e => e.trim()) || [];
          const isPreAuthorized = user.email && authorizedEmails.includes(user.email);
          
          console.log('[auth] session: Authorization check:', { 
            isPreAuthorized, 
            currentlyAuthorized: (user as any).isAuthorized,
            role: (user as any).role 
          });
          
          if (isPreAuthorized && !(user as any).isAuthorized) {
            console.log('[auth] session: Auto-authorizing pre-authorized user');
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
            console.log('[auth] session: User updated to system_admin');
          }
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
