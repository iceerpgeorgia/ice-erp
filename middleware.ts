import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

// Wrap withAuth so we can attach Cache-Control: no-store to every authenticated
// page response. This guarantees that after a new deploy, users always pull the
// latest HTML (and therefore the latest content-hashed JS bundle), preventing
// the situation where a stale client keeps calling the API with old code that
// ignores no-store fetch semantics.
export default withAuth(
  function middleware(req) {
    const res = NextResponse.next();
    const path = req.nextUrl.pathname;
    // Only add no-store on dictionary/page routes (HTML), not API responses
    // since API routes already set their own cache headers as appropriate.
    if (!path.startsWith("/api/")) {
      res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );
      res.headers.set("Pragma", "no-cache");
      res.headers.set("Expires", "0");
    }
    return res;
  },
  {
    pages: {
      signIn: "/auth/signin",
      error: "/auth/error",
    },
  }
);

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
