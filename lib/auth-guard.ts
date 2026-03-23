import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string;
    role: string;
    isAuthorized: boolean;
  };
};

/**
 * Require an authenticated session. Returns the session or a 401 response.
 * Usage:
 *   const authResult = await requireAuth();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const session = authResult; // typed AuthSession
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session as AuthSession;
}

/**
 * Require system_admin role. Returns the session or a 401/403 response.
 */
export async function requireAdmin(): Promise<AuthSession | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "system_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session as AuthSession;
}

/**
 * Type guard: returns true if the value is a NextResponse (auth failure).
 */
export function isAuthError(result: AuthSession | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
