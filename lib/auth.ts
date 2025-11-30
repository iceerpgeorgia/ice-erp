// lib/auth.ts (NextAuth v4)
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";

// Re-export prisma for backward compatibility
export { prisma } from "@/lib/prisma";

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
    strategy: "jwt", // Changed from "database" to reduce DB load
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist user data in JWT token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.role = (user as any).role || 'user';
        token.isAuthorized = (user as any).isAuthorized || false;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass user data from JWT to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
        session.user.isAuthorized = token.isAuthorized as boolean;
      }
      return session;
    },
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
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=',
};
