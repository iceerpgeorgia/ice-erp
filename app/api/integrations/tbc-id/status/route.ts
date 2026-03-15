import { NextRequest, NextResponse } from "next/server";
import { getOpenIdConfiguration, getTbcIdConfigStatus } from "@/lib/integrations/tbc-id/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const status = await getTbcIdConfigStatus();
    const shouldProbe = request.nextUrl.searchParams.get("probe") === "true";

    if (!shouldProbe) {
      return NextResponse.json({ ok: true, ...status });
    }

    const discovery = await getOpenIdConfiguration();

    return NextResponse.json({
      ok: true,
      ...status,
      discovery: {
        issuer: discovery.issuer,
        authorizationEndpoint: discovery.authorization_endpoint,
        tokenEndpoint: discovery.token_endpoint,
        userinfoEndpoint: discovery.userinfo_endpoint,
        jwksUri: discovery.jwks_uri,
        mtlsTokenEndpoint: discovery.mtls_endpoint_aliases?.token_endpoint || null,
        mtlsUserinfoEndpoint: discovery.mtls_endpoint_aliases?.userinfo_endpoint || null,
        scopesSupported: discovery.scopes_supported || [],
        grantTypesSupported: discovery.grant_types_supported || [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
