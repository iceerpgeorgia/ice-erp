/**
 * @jest-environment node
 */
import { NextResponse } from "next/server";
import { isAuthError, type AuthSession } from "@/lib/auth-guard";

// We can't easily unit-test requireAuth/requireAdmin since they call getServerSession
// which requires a Next.js server context. But we can test the type guard.

describe("isAuthError", () => {
  it("returns true for a NextResponse", () => {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    expect(isAuthError(response)).toBe(true);
  });

  it("returns false for a valid AuthSession", () => {
    const session: AuthSession = {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        image: "",
        role: "user",
        isAuthorized: true,
      },
    };
    expect(isAuthError(session)).toBe(false);
  });
});
