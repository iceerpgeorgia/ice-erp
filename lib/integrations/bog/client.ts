type BogTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
  scope?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

type BogCredentialEntry = {
  insiderUuid: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  scope?: string;
};

type ResolvedBogCredentials = {
  cacheKey: string;
  staticToken: string;
  clientId?: string;
  clientSecret?: string;
  scope: string;
};

export type BogRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
  retryOn401?: boolean;
  insiderUuid?: string;
};

export type BogApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  correlationId: string | null;
  data: T;
};

const cachedTokens = new Map<string, CachedToken>();

const DEFAULT_BOG_BASE_URL = 'https://api.businessonline.ge/api';
const DEFAULT_BOG_TOKEN_URL =
  'https://account.bog.ge/auth/realms/bog/protocol/openid-connect/token';

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function getBogBaseUrl() {
  return stripTrailingSlash(process.env.BOG_BASE_URL || DEFAULT_BOG_BASE_URL);
}

function getBogTokenUrl() {
  return stripTrailingSlash(process.env.BOG_TOKEN_URL || DEFAULT_BOG_TOKEN_URL);
}

function getBogScope() {
  return process.env.BOG_SCOPE || 'corp';
}

function normalizeInsiderUuid(value: string | undefined): string | null {
  const clean = String(value || '').trim();
  return clean || null;
}

function normalizeJsonEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Some platforms store JSON env values wrapped in quotes.
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
    // Some providers escape quotes in dashboard values.
    const unescaped = normalized.replace(/\\"/g, '"');
    try {
      const parsed = JSON.parse(unescaped);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function parseCredentialsMap(): BogCredentialEntry[] {
  const raw = process.env.BOG_CREDENTIALS_MAP;
  if (!raw) return [];

  const parsed = parseJsonEnvArray(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        insiderUuid: String(record.insiderUuid || record.INSIDER_UUID || '').trim(),
        clientId: String(record.clientId || record.BOG_CLIENT_ID || '').trim() || undefined,
        clientSecret: String(record.clientSecret || record.BOG_CLIENT_SECRET || '').trim() || undefined,
        accessToken: String(record.accessToken || record.BOG_ACCESS_TOKEN || '').trim() || undefined,
        scope: String(record.scope || record.BOG_SCOPE || '').trim() || undefined,
      };
    })
    .filter((entry) => entry.insiderUuid.length > 0);
}

function getStaticAccessToken() {
  return process.env.BOG_ACCESS_TOKEN || '';
}

function getLegacyCredentials() {
  const clientId = process.env.BOG_CLIENT_ID;
  const clientSecret = process.env.BOG_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

function resolveCredentials(insiderUuid?: string): ResolvedBogCredentials {
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
        scope: match.scope || getBogScope(),
      };
    }
  }

  const legacy = getLegacyCredentials();
  return {
    cacheKey: 'default',
    staticToken: getStaticAccessToken(),
    clientId: legacy?.clientId,
    clientSecret: legacy?.clientSecret,
    scope: getBogScope(),
  };
}

function hasDynamicCredentials(insiderUuid?: string) {
  const resolved = resolveCredentials(insiderUuid);
  return Boolean(resolved.clientId && resolved.clientSecret);
}

function buildBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
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

export async function getBogAccessToken(options?: { forceRefresh?: boolean; insiderUuid?: string }) {
  const resolved = resolveCredentials(options?.insiderUuid);
  const staticToken = resolved.staticToken;
  if (staticToken && !options?.forceRefresh) {
    return staticToken;
  }

  const cachedToken = cachedTokens.get(resolved.cacheKey);
  if (!options?.forceRefresh && cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.accessToken;
  }

  const credentials = resolved.clientId && resolved.clientSecret
    ? { clientId: resolved.clientId, clientSecret: resolved.clientSecret }
    : null;

  if (!credentials) {
    if (staticToken) return staticToken;
    throw new Error(
      'BOG credentials are missing. Set BOG_CREDENTIALS_MAP for insider-based credentials, or fallback BOG_CLIENT_ID/BOG_CLIENT_SECRET, or provide BOG_ACCESS_TOKEN.'
    );
  }

  const form = new URLSearchParams();
  form.set('grant_type', 'client_credentials');
  form.set('client_id', credentials.clientId);
  form.set('client_secret', credentials.clientSecret);
  form.set('scope', resolved.scope);

  const response = await fetch(getBogTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${buildBasicAuth(credentials.clientId, credentials.clientSecret)}`,
    },
    body: form.toString(),
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => ({}))) as BogTokenResponse;

  if (!response.ok || !json.access_token) {
    throw new Error(`Failed to get BOG token (${response.status}).`);
  }

  const expiresIn = Number(json.expires_in || 300);
  cachedTokens.set(resolved.cacheKey, {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + Math.max(30, expiresIn - 30) * 1000,
  });

  return json.access_token;
}

export async function bogApiRequest<T = unknown>(options: BogRequestOptions): Promise<BogApiResponse<T>> {
  const method = options.method || 'GET';
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`;
  const retryOn401 = options.retryOn401 !== false;

  const execute = async (token: string) => {
    const response = await fetch(`${getBogBaseUrl()}${normalizedPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });

    const data = (await response.json().catch(async () => {
      const text = await response.text().catch(() => '');
      return { raw: text };
    })) as T;

    return {
      ok: response.ok,
      status: response.status,
      correlationId: response.headers.get('x-correlationid'),
      data,
    };
  };

  const initialToken = options.token || (await getBogAccessToken({ insiderUuid: options.insiderUuid }));
  const firstResult = await execute(initialToken);

  if (
    firstResult.status === 401 &&
    retryOn401 &&
    !options.token &&
    hasDynamicCredentials(options.insiderUuid)
  ) {
    const refreshedToken = await getBogAccessToken({ forceRefresh: true, insiderUuid: options.insiderUuid });
    return execute(refreshedToken);
  }

  return firstResult;
}

export function getBogConfigStatus() {
  const credentialsMap = parseCredentialsMap();

  return {
    hasCredentialsMap: credentialsMap.length > 0,
    mappedInsiderCount: credentialsMap.length,
    hasClientId: Boolean(process.env.BOG_CLIENT_ID),
    hasClientSecret: Boolean(process.env.BOG_CLIENT_SECRET),
    hasStaticAccessToken: Boolean(process.env.BOG_ACCESS_TOKEN),
    baseUrl: getBogBaseUrl(),
    tokenUrl: getBogTokenUrl(),
    scope: getBogScope(),
  };
}
