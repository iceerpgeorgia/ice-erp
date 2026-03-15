import axios from "axios";
import https from "https";
import crypto from "crypto";

export type TbcOpenIdConfiguration = {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	jwks_uri: string;
	mtls_endpoint_aliases?: {
		token_endpoint?: string;
		userinfo_endpoint?: string;
	};
	scopes_supported?: string[];
	grant_types_supported?: string[];
	userinfo_signing_alg_values_supported?: string[];
};

export type TbcTokenResponse = {
	access_token: string;
	token_type?: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
	id_token?: string;
};

export type JwtParts = {
	rawHeader: Record<string, unknown>;
	rawPayload: Record<string, unknown>;
};

type JwkKey = {
	kid: string;
	kty: string;
	alg?: string;
	use?: string;
	n?: string;
	e?: string;
};

type JwksResponse = {
	keys: JwkKey[];
};

type MtlsOptions = {
	httpsAgent: https.Agent;
	isConfigured: boolean;
	mode: "pfx" | "pem" | "none";
};

function normalizeMultilineEnv(value?: string) {
	if (!value) return "";
	return value.replace(/\\n/g, "\n").trim();
}

function stripTrailingSlash(url: string) {
	return url.replace(/\/$/, "");
}

function getBaseUrl() {
	return stripTrailingSlash(process.env.TBC_ID_BASE_URL || "https://test-api.tbcbank.ge");
}

export function getConfigurationUrl() {
	return `${getBaseUrl()}/.well-known/openid-configuration`;
}

function decodeBase64UrlJson(value: string) {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	const json = Buffer.from(padded, "base64").toString("utf8");
	return JSON.parse(json) as Record<string, unknown>;
}

export function decodeJwtParts(jwt: string): JwtParts {
	const parts = jwt.split(".");
	if (parts.length < 2) {
		throw new Error("JWT format is invalid.");
	}

	return {
		rawHeader: decodeBase64UrlJson(parts[0]),
		rawPayload: decodeBase64UrlJson(parts[1]),
	};
}

export function generatePkcePair() {
	const verifier = crypto.randomBytes(32).toString("base64url");
	const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
	return {
		codeVerifier: verifier,
		codeChallenge: challenge,
		codeChallengeMethod: "S256" as const,
	};
}

export function generateState() {
	return crypto.randomBytes(16).toString("hex");
}

export function generateNonce() {
	return crypto.randomBytes(16).toString("hex");
}

function getMtlsOptions(): MtlsOptions {
	const pfxBase64 = normalizeMultilineEnv(process.env.TBC_ID_MTLS_PFX_BASE64);
	const pfxPassphrase = process.env.TBC_ID_MTLS_PFX_PASSPHRASE || "";

	const cert = normalizeMultilineEnv(process.env.TBC_ID_MTLS_CERT_PEM);
	const key = normalizeMultilineEnv(process.env.TBC_ID_MTLS_KEY_PEM);
	const ca = normalizeMultilineEnv(process.env.TBC_ID_MTLS_CA_PEM);
	const passphrase = process.env.TBC_ID_MTLS_KEY_PASSPHRASE || "";
	const rejectUnauthorized = (process.env.TBC_ID_MTLS_REJECT_UNAUTHORIZED || "true") !== "false";

	if (pfxBase64) {
		return {
			isConfigured: true,
			mode: "pfx",
			httpsAgent: new https.Agent({
				pfx: Buffer.from(pfxBase64, "base64"),
				passphrase: pfxPassphrase || undefined,
				rejectUnauthorized,
			}),
		};
	}

	if (cert && key) {
		return {
			isConfigured: true,
			mode: "pem",
			httpsAgent: new https.Agent({
				cert,
				key,
				ca: ca || undefined,
				passphrase: passphrase || undefined,
				rejectUnauthorized,
			}),
		};
	}

	return {
		isConfigured: false,
		mode: "none",
		httpsAgent: new https.Agent({ rejectUnauthorized }),
	};
}

let configCache: { value: TbcOpenIdConfiguration; expiresAt: number } | null = null;

export async function getOpenIdConfiguration(forceRefresh = false): Promise<TbcOpenIdConfiguration> {
	if (!forceRefresh && configCache && Date.now() < configCache.expiresAt) {
		return configCache.value;
	}

	const response = await axios.get<TbcOpenIdConfiguration>(getConfigurationUrl(), {
		timeout: 15000,
		headers: { Accept: "application/json" },
	});

	configCache = {
		value: response.data,
		expiresAt: Date.now() + 10 * 60 * 1000,
	};

	return response.data;
}

export async function buildAuthorizeUrl(input?: {
	redirectUri?: string;
	clientId?: string;
	scope?: string;
	state?: string;
	nonce?: string;
	codeChallenge?: string;
	claims?: unknown;
	uiLocales?: string;
	loginHintPersonalNumber?: string;
	loginHintMsisdn?: string;
}) {
	const config = await getOpenIdConfiguration();
	const clientId = input?.clientId || process.env.TBC_ID_CLIENT_ID;
	const redirectUri = input?.redirectUri || process.env.TBC_ID_REDIRECT_URI;
	const scope = input?.scope || process.env.TBC_ID_SCOPE || "openid profile";

	if (!clientId) throw new Error("TBC_ID_CLIENT_ID is not configured.");
	if (!redirectUri) throw new Error("TBC_ID_REDIRECT_URI is not configured.");

	const state = input?.state || generateState();
	const nonce = input?.nonce || generateNonce();
	const pkce = input?.codeChallenge
		? { codeChallenge: input.codeChallenge, codeVerifier: undefined }
		: generatePkcePair();

	const url = new URL(config.authorization_endpoint);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", redirectUri);
	url.searchParams.set("scope", scope);
	url.searchParams.set("state", state);
	url.searchParams.set("nonce", nonce);

	if (pkce.codeChallenge) {
		url.searchParams.set("code_challenge", pkce.codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
	}

	if (input?.claims) {
		url.searchParams.set("claims", JSON.stringify(input.claims));
	}

	if (input?.uiLocales) {
		url.searchParams.set("ui_locales", input.uiLocales);
	}

	if (input?.loginHintPersonalNumber && input?.loginHintMsisdn) {
		throw new Error("Use only one login hint: personal number or msisdn.");
	}

	if (input?.loginHintPersonalNumber) {
		url.searchParams.set("login_hint", JSON.stringify({ personal_number: input.loginHintPersonalNumber }));
	}

	if (input?.loginHintMsisdn) {
		url.searchParams.set("login_hint", JSON.stringify({ msisdn: input.loginHintMsisdn }));
	}

	return {
		authorizationUrl: url.toString(),
		state,
		nonce,
		codeVerifier: pkce.codeVerifier,
	};
}

function resolveTokenEndpoint(config: TbcOpenIdConfiguration) {
	return config.mtls_endpoint_aliases?.token_endpoint || config.token_endpoint;
}

function resolveUserInfoEndpoint(config: TbcOpenIdConfiguration) {
	return config.mtls_endpoint_aliases?.userinfo_endpoint || config.userinfo_endpoint;
}

function getTokenClientCredentials() {
	const clientId = process.env.TBC_ID_CLIENT_ID;
	const clientSecret = process.env.TBC_ID_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Set TBC_ID_CLIENT_ID and TBC_ID_CLIENT_SECRET.");
	}

	return { clientId, clientSecret };
}

export async function exchangeAuthorizationCode(input: {
	code: string;
	codeVerifier: string;
	redirectUri?: string;
}) {
	const config = await getOpenIdConfiguration();
	const endpoint = resolveTokenEndpoint(config);
	const mtls = getMtlsOptions();

	if (!mtls.isConfigured) {
		throw new Error("mTLS is not configured. Set TBC_ID_MTLS_* environment variables.");
	}

	const { clientId, clientSecret } = getTokenClientCredentials();
	const redirectUri = input.redirectUri || process.env.TBC_ID_REDIRECT_URI;

	if (!redirectUri) {
		throw new Error("TBC_ID_REDIRECT_URI is required.");
	}

	const form = new URLSearchParams();
	form.set("grant_type", "authorization_code");
	form.set("client_id", clientId);
	form.set("client_secret", clientSecret);
	form.set("code", input.code);
	form.set("code_verifier", input.codeVerifier);
	form.set("redirect_uri", redirectUri);

	const response = await axios.post<TbcTokenResponse>(endpoint, form.toString(), {
		timeout: 20000,
		httpsAgent: mtls.httpsAgent,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
	});

	return response.data;
}

export async function refreshToken(refreshToken: string) {
	const config = await getOpenIdConfiguration();
	const endpoint = resolveTokenEndpoint(config);
	const mtls = getMtlsOptions();

	if (!mtls.isConfigured) {
		throw new Error("mTLS is not configured. Set TBC_ID_MTLS_* environment variables.");
	}

	const { clientId, clientSecret } = getTokenClientCredentials();

	const form = new URLSearchParams();
	form.set("grant_type", "refresh_token");
	form.set("client_id", clientId);
	form.set("client_secret", clientSecret);
	form.set("refresh_token", refreshToken);

	const response = await axios.post<TbcTokenResponse>(endpoint, form.toString(), {
		timeout: 20000,
		httpsAgent: mtls.httpsAgent,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
	});

	return response.data;
}

export async function getUserInfoJwt(accessToken: string) {
	const config = await getOpenIdConfiguration();
	const endpoint = resolveUserInfoEndpoint(config);
	const mtls = getMtlsOptions();

	if (!mtls.isConfigured) {
		throw new Error("mTLS is not configured. Set TBC_ID_MTLS_* environment variables.");
	}

	const response = await axios.get<string>(endpoint, {
		timeout: 20000,
		httpsAgent: mtls.httpsAgent,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/jwt, application/json",
		},
		responseType: "text",
		transformResponse: [(data) => data],
	});

	return response.data;
}

async function getJwks(config?: TbcOpenIdConfiguration): Promise<JwksResponse> {
	const resolved = config || (await getOpenIdConfiguration());
	const response = await axios.get<JwksResponse>(resolved.jwks_uri, {
		timeout: 15000,
		headers: { Accept: "application/json" },
	});

	return response.data;
}

function asText(value: unknown) {
	return typeof value === "string" ? value : "";
}

export async function verifyJwtWithJwks(jwt: string, expectedAud?: string) {
	const parts = jwt.split(".");
	if (parts.length !== 3) {
		throw new Error("JWT must have 3 parts.");
	}

	const { rawHeader, rawPayload } = decodeJwtParts(jwt);
	const kid = asText(rawHeader.kid);
	const alg = asText(rawHeader.alg);
	if (!kid) throw new Error("JWT header missing kid.");
	if (alg !== "RS256") throw new Error(`Unsupported JWT alg: ${alg || "unknown"}`);

	const jwks = await getJwks();
	const jwk = jwks.keys.find((key) => key.kid === kid);
	if (!jwk) throw new Error(`No matching JWK found for kid ${kid}.`);
	if (jwk.kty !== "RSA") throw new Error(`Unsupported JWK type ${jwk.kty}.`);

	const verifier = crypto.createVerify("RSA-SHA256");
	verifier.update(`${parts[0]}.${parts[1]}`);
	verifier.end();

	const signature = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
	const publicKey = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: "jwk" });
	const isValid = verifier.verify(publicKey, signature);

	if (!isValid) {
		throw new Error("JWT signature verification failed.");
	}

	const expectedIssuer = getBaseUrl();
	const issuer = asText(rawPayload.iss);
	if (issuer && issuer !== expectedIssuer) {
		throw new Error(`Unexpected issuer. Expected ${expectedIssuer}, got ${issuer}.`);
	}

	const aud = rawPayload.aud;
	if (expectedAud) {
		const audienceMatch = Array.isArray(aud) ? aud.includes(expectedAud) : aud === expectedAud;
		if (!audienceMatch) {
			throw new Error("JWT audience mismatch.");
		}
	}

	return {
		header: rawHeader,
		payload: rawPayload,
		verified: true,
	};
}

export async function getTbcIdConfigStatus() {
	const mtls = getMtlsOptions();

	return {
		baseUrl: getBaseUrl(),
		configurationUrl: getConfigurationUrl(),
		hasClientId: Boolean(process.env.TBC_ID_CLIENT_ID),
		hasClientSecret: Boolean(process.env.TBC_ID_CLIENT_SECRET),
		hasRedirectUri: Boolean(process.env.TBC_ID_REDIRECT_URI),
		configuredScope: process.env.TBC_ID_SCOPE || "openid profile",
		mtlsConfigured: mtls.isConfigured,
		mtlsMode: mtls.mode,
		rejectUnauthorized: (process.env.TBC_ID_MTLS_REJECT_UNAUTHORIZED || "true") !== "false",
	};
}
