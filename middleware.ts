import { withAuth } from "next-auth/middleware";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

export default withAuth({
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dictionaries/:path*",
    "/bank-transactions/:path*",
    "/counteragent-statement/:path*",
    "/payment-statement/:path*",
    "/salary-report/:path*",
    "/admin/:path*",
    "/api/((?!auth|cron|test-env).*)",
  ],
};
