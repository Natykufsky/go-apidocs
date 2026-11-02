import type { StoredCredentials } from '../context/AuthContext';

export interface ExtractedTokens {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  entityId?: string;
  expiresAt?: string;
}

/**
 * Decode the `exp` claim from a JWT access token (if it is a valid 3-part JWT)
 * and return an ISO-8601 expiration timestamp.
 */
export function decodeJwtExpiry(token: string): string | undefined {
  if (!token || typeof token !== 'string') return undefined;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (payload && typeof payload.exp === 'number' && payload.exp > 0) {
      return new Date(payload.exp * 1000).toISOString();
    }
  } catch {
    // Not a standard JSON JWT or invalid base64
  }
  return undefined;
}

/**
 * Resolve an expiration ISO timestamp from a response object or JWT token.
 */
export function resolveExpiresAt(
  source: Record<string, any>,
  accessToken?: string,
): string | undefined {
  const rawExpiresAt = source.expires_at ?? source.expiresAt ?? source.expiration;
  if (rawExpiresAt) {
    if (typeof rawExpiresAt === 'number') {
      // Epoch seconds vs milliseconds
      const ms = rawExpiresAt < 1e12 ? rawExpiresAt * 1000 : rawExpiresAt;
      return new Date(ms).toISOString();
    }
    if (typeof rawExpiresAt === 'string') {
      const parsed = Date.parse(rawExpiresAt);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    }
  }

  const rawExpiresIn = source.expires_in ?? source.expiresIn ?? source.ttl;
  if (rawExpiresIn !== undefined && rawExpiresIn !== null) {
    const secs = Number(rawExpiresIn);
    if (!Number.isNaN(secs) && secs > 0) {
      return new Date(Date.now() + secs * 1000).toISOString();
    }
  }

  if (accessToken) {
    return decodeJwtExpiry(accessToken);
  }

  return undefined;
}

/**
 * Inspect an arbitrary JSON response body (including nested envelopes like
 * `data`, `payload`, `result`, `tokens`, `auth`, `session`) and extract
 * authentication tokens, tenant/entity identifiers, and expiry metadata.
 */
export function extractTokensFromPayload(body: unknown): ExtractedTokens | null {
  if (!body || typeof body !== 'object') return null;

  const root = body as Record<string, any>;
  // Candidate containers in priority order
  const candidates: Record<string, any>[] = [root];
  for (const key of ['data', 'payload', 'result', 'tokens', 'auth', 'session']) {
    const nested = root[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      candidates.push(nested);
      // Also check 2-level nesting e.g. { data: { tokens: { access_token: ... } } }
      for (const subKey of ['tokens', 'auth', 'session', 'credentials']) {
        if (nested[subKey] && typeof nested[subKey] === 'object' && !Array.isArray(nested[subKey])) {
          candidates.push(nested[subKey]);
        }
      }
    }
  }

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let tenantId: string | undefined;
  let entityId: string | undefined;
  let expiresAt: string | undefined;

  for (const c of candidates) {
    if (!accessToken) {
      const tok =
        c.access_token ??
        c.accessToken ??
        c.token ??
        c.jwt ??
        c.bearer_token ??
        c.bearerToken ??
        c.id_token ??
        c.idToken;
      if (typeof tok === 'string' && tok.trim()) {
        accessToken = tok.trim();
      }
    }

    if (!refreshToken) {
      const ref =
        c.refresh_token ??
        c.refreshToken ??
        c.renew_token ??
        c.renewToken;
      if (typeof ref === 'string' && ref.trim()) {
        refreshToken = ref.trim();
      }
    }

    if (!tenantId) {
      const tid = c.tenant_id ?? c.tenantId ?? (typeof c.tenant === 'string' || typeof c.tenant === 'number' ? c.tenant : undefined);
      if (tid !== undefined && tid !== null && String(tid).trim()) {
        tenantId = String(tid).trim();
      }
    }

    if (!entityId) {
      const eid = c.entity_id ?? c.entityId ?? (typeof c.entity === 'string' || typeof c.entity === 'number' ? c.entity : undefined);
      if (eid !== undefined && eid !== null && String(eid).trim()) {
        entityId = String(eid).trim();
      }
    }

    if (!expiresAt) {
      expiresAt = resolveExpiresAt(c, undefined);
    }
  }

  if (!expiresAt && accessToken) {
    expiresAt = decodeJwtExpiry(accessToken);
  }

  if (!accessToken && !refreshToken && !tenantId && !entityId) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    tenantId,
    entityId,
    expiresAt,
  };
}

/**
 * Heuristic to detect a token refresh endpoint from a list of OpenAPI endpoint keys
 * (e.g., `["POST /api/v1/auth/login", "POST /api/v1/auth/refresh"]`).
 */
export function detectRefreshEndpoint(endpoints: string[]): string | undefined {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return undefined;

  const postEndpoints = endpoints
    .map((ep) => {
      const parts = ep.trim().split(/\s+/);
      const method = (parts[0] || '').toUpperCase();
      const path = parts.slice(1).join(' ');
      return { method, path };
    })
    .filter((e) => e.method === 'POST' && e.path);

  // Priority patterns for refresh routes
  const patterns = [
    /\/auth\/refresh\b/i,
    /\/token\/refresh\b/i,
    /\/refresh[-_]?token\b/i,
    /\/oauth2?\/token\b/i,
    /\/sessions?\/refresh\b/i,
    /\/refresh\b/i,
  ];

  for (const pattern of patterns) {
    const match = postEndpoints.find((e) => pattern.test(e.path));
    if (match) return match.path;
  }

  return undefined;
}

/**
 * Merge newly extracted tokens into existing credentials.
 */
export function mergeExtractedCredentials(
  current: StoredCredentials,
  extracted: ExtractedTokens,
): StoredCredentials {
  return {
    ...current,
    accessToken: extracted.accessToken || current.accessToken,
    refreshToken: extracted.refreshToken || current.refreshToken,
    tenantId: extracted.tenantId || current.tenantId,
    entityId: extracted.entityId || current.entityId,
    expiresAt: extracted.expiresAt || (extracted.accessToken ? decodeJwtExpiry(extracted.accessToken) : current.expiresAt),
    updatedAt: new Date().toLocaleTimeString(),
  };
}
