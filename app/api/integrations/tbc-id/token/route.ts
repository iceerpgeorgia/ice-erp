import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, refreshToken } from "@/lib/integrations/tbc-id/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedIfSecretMismatch(request: NextRequest) {
  const configuredSecret = process.env.TBC_ID_TRIGGER_SECRET;
  if (!configuredSecret) return null;

  const incomingSecret = request.headers.get("x-tbc-trigger-secret");
  if (!incomingSecret || incomingSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized trigger request" }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = unauthorizedIfSecretMismatch(request);
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as {
      grantType: "authorization_code" | "refresh_token";
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
      refreshToken?: string;
    };

    if (body.grantType === "authorization_code") {
      if (!body.code || !body.codeVerifier) {
        return NextResponse.json(
          { ok: false, error: "code and codeVerifier are required for authorization_code" },
          { status: 400 }
        );
      }

      const token = await exchangeAuthorizationCode({
        code: body.code,
        codeVerifier: body.codeVerifier,
        redirectUri: body.redirectUri,
      });

      return NextResponse.json({ ok: true, token });
    }

    if (body.grantType === "refresh_token") {
      if (!body.refreshToken) {
        return NextResponse.json(
          { ok: false, error: "refreshToken is required for refresh_token" },
          { status: 400 }
        );
      }

      const token = await refreshToken(body.refreshToken);
      return NextResponse.json({ ok: true, token });
    }

    return NextResponse.json({ ok: false, error: "Unsupported grantType" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
