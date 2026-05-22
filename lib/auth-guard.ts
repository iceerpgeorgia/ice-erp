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

/**
 * Allow either a valid user session OR a valid CRON_SECRET bearer token.
 * Use for routes that can be called both from the UI and from automation.
 */
export async function requireAuthOrCron(
  req: import('next/server').NextRequest,
): Promise<AuthSession | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Treat as a synthetic session for cron/API callers
    return {
      user: { id: 'cron', email: 'cron@system', name: 'Cron', image: '', role: 'system_admin', isAuthorized: true },
    };
  }
  return requireAuth();
}
