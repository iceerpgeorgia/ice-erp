import { NextRequest, NextResponse } from "next/server";
import { decodeJwtParts, getUserInfoJwt, verifyJwtWithJwks } from "@/lib/integrations/tbc-id/client";

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
      accessToken?: string;
      expectedAud?: string;
      verifySignature?: boolean;
    };

    if (!body.accessToken) {
      return NextResponse.json({ ok: false, error: "accessToken is required" }, { status: 400 });
    }

    const userInfoJwt = await getUserInfoJwt(body.accessToken);
    const decoded = decodeJwtParts(userInfoJwt);

    const verifySignature = body.verifySignature !== false;
    const verification = verifySignature
      ? await verifyJwtWithJwks(userInfoJwt, body.expectedAud || process.env.TBC_ID_CLIENT_ID)
      : null;

    return NextResponse.json({
      ok: true,
      userInfoJwt,
      decoded,
      verification,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
