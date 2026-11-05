import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';

type TbcBisTokenResponse = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

type TbcBisCredentialEntry = {
  insiderUuid: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  scope?: string;
  tokenUrl?: string;
  baseUrl?: string;
};

type ResolvedTbcBisCredentials = {
  cacheKey: string;
  staticToken: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  tokenUrl?: string;
  baseUrl?: string;
};

export type TbcBisRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  retryOn401?: boolean;
  insiderUuid?: string;
};

export type TbcBisApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  correlationId: string | null;
  data: T;
};

const DEFAULT_TBC_BIS_BASE_URL = 'https://test-api.tbcbank.ge';
const cachedTokens = new Map<string, CachedToken>();

function normalizeMultilineEnv(value?: string) {
  if (!value) return '';
  return value.replace(/\\n/g, '\n').trim();
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function normalizeInsiderUuid(value: string | undefined): string | null {
  const clean = String(value || '').trim();
  return clean || null;
}

function normalizeJsonEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseJsonEnvArray(raw: string): unknown[] {
  const normalized = normalizeJsonEnvValue(raw);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const unescaped = normalized.replace(/\\"/g, '"');
    try {
      const parsed = JSON.parse(unescaped);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function parseCredentialsMap(): TbcBisCredentialEntry[] {
  const raw = process.env.TBC_BIS_CREDENTIALS_MAP;
  if (!raw) return [];

  const parsed = parseJsonEnvArray(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        insiderUuid: String(row.insiderUuid || row.INSIDER_UUID || '').trim(),
        clientId: String(row.clientId || row.TBC_BIS_CLIENT_ID || '').trim() || undefined,
        clientSecret:
          String(row.clientSecret || row.TBC_BIS_CLIENT_SECRET || '').trim() || undefined,
        accessToken: String(row.accessToken || row.TBC_BIS_ACCESS_TOKEN || '').trim() || undefined,
        scope: String(row.scope || row.TBC_BIS_SCOPE || '').trim() || undefined,
        tokenUrl: String(row.tokenUrl || row.TBC_BIS_TOKEN_URL || '').trim() || undefined,
        baseUrl: String(row.baseUrl || row.TBC_BIS_BASE_URL || '').trim() || undefined,
      };
    })
    .filter((entry) => entry.insiderUuid.length > 0);
}

function getLegacyCredentials() {
  const clientId = process.env.TBC_BIS_CLIENT_ID;
  const clientSecret = process.env.TBC_BIS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

function getStaticAccessToken() {
  return process.env.TBC_BIS_ACCESS_TOKEN || '';
}

function getDefaultScope() {
  const scope = String(process.env.TBC_BIS_SCOPE || '').trim();
  return scope || undefined;
}

function getDefaultTokenUrl() {
  const tokenUrl = String(process.env.TBC_BIS_TOKEN_URL || '').trim();
  return tokenUrl || undefined;
}

function getDefaultBaseUrl() {
  const base = String(process.env.TBC_BIS_BASE_URL || DEFAULT_TBC_BIS_BASE_URL).trim();
  return stripTrailingSlash(base || DEFAULT_TBC_BIS_BASE_URL);
}

function resolveCredentials(insiderUuid?: string): ResolvedTbcBisCredentials {
  const normalizedInsiderUuid = normalizeInsiderUuid(insiderUuid);
  const mapped = parseCredentialsMap();

  if (normalizedInsiderUuid && mapped.length > 0) {
    const match = mapped.find(
      (entry) => entry.insiderUuid.toLowerCase() === normalizedInsiderUuid.toLowerCase()
    );

    if (match) {
      return {
        cacheKey: `insider:${match.insiderUuid.toLowerCase()}`,
        staticToken: match.accessToken || '',
        clientId: match.clientId,
        clientSecret: match.clientSecret,
        scope: match.scope,
        tokenUrl: match.tokenUrl,
        baseUrl: match.baseUrl,
      };
    }
  }

  const legacy = getLegacyCredentials();
  return {
    cacheKey: 'default',
    staticToken: getStaticAccessToken(),
    clientId: legacy?.clientId,
    clientSecret: legacy?.clientSecret,
    scope: getDefaultScope(),
    tokenUrl: getDefaultTokenUrl(),
    baseUrl: getDefaultBaseUrl(),
  };
}

function buildBaseUrl(insiderUuid?: string): string {
  const resolved = resolveCredentials(insiderUuid);
  const perInsider = String(resolved.baseUrl || '').trim();
  if (perInsider) return stripTrailingSlash(perInsider);
  return getDefaultBaseUrl();
}

function buildTokenUrl(insiderUuid?: string): string | null {
  const resolved = resolveCredentials(insiderUuid);
  const direct = String(resolved.tokenUrl || '').trim();
  if (direct) return stripTrailingSlash(direct);

  const global = String(process.env.TBC_BIS_TOKEN_URL || '').trim();
  if (global) return stripTrailingSlash(global);

  return null;
}

function hasDynamicCredentials(insiderUuid?: string) {
  const resolved = resolveCredentials(insiderUuid);
  return Boolean(resolved.clientId && resolved.clientSecret);
}

function buildMtlsAgent() {
  const pfxBase64 = normalizeMultilineEnv(process.env.TBC_BIS_MTLS_PFX_BASE64);
  const pfxPassphrase = process.env.TBC_BIS_MTLS_PFX_PASSPHRASE || '';

  const cert = normalizeMultilineEnv(process.env.TBC_BIS_MTLS_CERT_PEM);
  const key = normalizeMultilineEnv(process.env.TBC_BIS_MTLS_KEY_PEM);
  const ca = normalizeMultilineEnv(process.env.TBC_BIS_MTLS_CA_PEM);
  const passphrase = process.env.TBC_BIS_MTLS_KEY_PASSPHRASE || '';
  const rejectUnauthorized = (process.env.TBC_BIS_MTLS_REJECT_UNAUTHORIZED || 'true') !== 'false';

  if (pfxBase64) {
    return new https.Agent({
      pfx: Buffer.from(pfxBase64, 'base64'),
      passphrase: pfxPassphrase || undefined,
      rejectUnauthorized,
    });
  }

  if (cert && key) {
    return new https.Agent({
      cert,
      key,
      ca: ca || undefined,
      passphrase: passphrase || undefined,
      rejectUnauthorized,
    });
  }

  return new https.Agent({ rejectUnauthorized });
}

export function getTbcBisConfigStatus() {
  const credentialsMap = parseCredentialsMap();
  const legacy = getLegacyCredentials();
  return {
    baseUrl: getDefaultBaseUrl(),
    hasCredentialsMap: credentialsMap.length > 0,
    credentialMapCount: credentialsMap.length,
    hasClientId: Boolean(legacy?.clientId),
    hasClientSecret: Boolean(legacy?.clientSecret),
    hasStaticAccessToken: Boolean(getStaticAccessToken()),
    hasTokenUrl: Boolean(getDefaultTokenUrl()),
    hasMtlsPfx: Boolean(normalizeMultilineEnv(process.env.TBC_BIS_MTLS_PFX_BASE64)),
    hasMtlsPem: Boolean(
      normalizeMultilineEnv(process.env.TBC_BIS_MTLS_CERT_PEM) &&
        normalizeMultilineEnv(process.env.TBC_BIS_MTLS_KEY_PEM)
    ),
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getTokenPreview(token: string) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  const iat = typeof payload?.iat === 'number' ? payload.iat : null;

  return {
    preview:
      token.length > 16 ? `${token.slice(0, 8)}...${token.slice(-8)}` : `${token.slice(0, 4)}...`,
    expiresAtIso: exp ? new Date(exp * 1000).toISOString() : null,
    issuedAtIso: iat ? new Date(iat * 1000).toISOString() : null,
    hasJwtShape: token.split('.').length >= 3,
  };
}

export async function getTbcBisAccessToken(options?: {
  forceRefresh?: boolean;
  insiderUuid?: string;
}) {
  const resolved = resolveCredentials(options?.insiderUuid);
  const staticToken = resolved.staticToken;
  if (staticToken && !options?.forceRefresh) {
    return staticToken;
  }

  const cachedToken = cachedTokens.get(resolved.cacheKey);
  if (!options?.forceRefresh && cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.accessToken;
  }

  const credentials =
    resolved.clientId && resolved.clientSecret
      ? { clientId: resolved.clientId, clientSecret: resolved.clientSecret }
      : null;

  if (!credentials) {
    if (staticToken) return staticToken;
    throw new Error(
      'TBC BIS credentials are missing. Set TBC_BIS_CREDENTIALS_MAP or fallback TBC_BIS_CLIENT_ID/TBC_BIS_CLIENT_SECRET or TBC_BIS_ACCESS_TOKEN.'
    );
  }

  const tokenUrl = buildTokenUrl(options?.insiderUuid);
  if (!tokenUrl) {
    throw new Error(
      'TBC BIS token URL is missing. Set TBC_BIS_TOKEN_URL (or tokenUrl in TBC_BIS_CREDENTIALS_MAP).'
    );
  }

  const form = new URLSearchParams();
  form.set('grant_type', 'client_credentials');
  form.set('client_id', credentials.clientId);
  form.set('client_secret', credentials.clientSecret);
  if (resolved.scope) {
    form.set('scope', resolved.scope);
  }

  const response = await axios.post<TbcBisTokenResponse>(tokenUrl, form.toString(), {
    timeout: 20000,
    httpsAgent: buildMtlsAgent(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  const token = response.data?.access_token;
  if (!token) {
    throw new Error(`Failed to get TBC BIS token (${response.status})`);
  }

  const expiresIn = Number(response.data?.expires_in || 300);
  cachedTokens.set(resolved.cacheKey, {
    accessToken: token,
    expiresAtMs: Date.now() + Math.max(30, expiresIn - 30) * 1000,
  });

  return token;
}

function toCorrelationId(headers: Record<string, unknown>) {
  const candidates = ['x-correlation-id', 'x-request-id', 'trace-id'];
  for (const key of candidates) {
    const value = headers[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

async function performTbcBisRequest<T = unknown>(
  options: TbcBisRequestOptions,
  token: string
): Promise<TbcBisApiResponse<T>> {
  const method = options.method || 'GET';
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const url = `${buildBaseUrl(options.insiderUuid)}${normalizedPath}`;

  const requestConfig: AxiosRequestConfig = {
    method,
    url,
    timeout: 45000,
    httpsAgent: buildMtlsAgent(),
    headers: {
      Accept: 'application/json, application/xml, text/xml, text/plain',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    data: options.body,
    validateStatus: () => true,
  };

  const response = await axios.request(requestConfig);
  const headerRecord = (response.headers || {}) as Record<string, unknown>;

  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    correlationId: toCorrelationId(headerRecord),
    data: response.data as T,
  };
}

export async function tbcBisApiRequest<T = unknown>(
  options: TbcBisRequestOptions
): Promise<TbcBisApiResponse<T>> {
  const retryOn401 = options.retryOn401 !== false;
  const initialToken =
    options.token || (await getTbcBisAccessToken({ insiderUuid: options.insiderUuid }));

  const first = await performTbcBisRequest<T>(options, initialToken);
  if (first.status !== 401 || !retryOn401 || options.token || !hasDynamicCredentials(options.insiderUuid)) {
    return first;
  }

  const refreshedToken = await getTbcBisAccessToken({
    forceRefresh: true,
    insiderUuid: options.insiderUuid,
  });

  return performTbcBisRequest<T>(options, refreshedToken);
}

