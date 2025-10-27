import { withAuth } from "next-auth/middleware";

// Explicitly set NEXTAUTH_SECRET for Edge runtime
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=';

export default withAuth({
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export const config = {
  matcher: ["/dashboard"],
};
