import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/integrations/tbc-id/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      redirectUri?: string;
      clientId?: string;
      scope?: string;
      uiLocales?: string;
      claims?: unknown;
      loginHintPersonalNumber?: string;
      loginHintMsisdn?: string;
    };

    const result = await buildAuthorizeUrl({
      redirectUri: body.redirectUri,
      clientId: body.clientId,
      scope: body.scope,
      uiLocales: body.uiLocales,
      claims: body.claims,
      loginHintPersonalNumber: body.loginHintPersonalNumber,
      loginHintMsisdn: body.loginHintMsisdn,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      note: "Persist state, nonce, and codeVerifier on your side before redirecting the user.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 400 });
  }
}
