import { describe, it, expect } from 'vitest';
import {
  decodeJwtExpiry,
  extractTokensFromPayload,
  detectRefreshEndpoint,
  mergeExtractedCredentials,
} from './tokenUtils';

// Helper to create a dummy unsigned JWT with a specific `exp` (in seconds)
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('tokenUtils', () => {
  it('decodes exp claim from a standard 3-part JWT', () => {
    const futureSec = Math.floor(Date.now() / 1000) + 3600;
    const jwt = makeJwt({ sub: 'user_1', exp: futureSec });
    const iso = decodeJwtExpiry(jwt);
    expect(iso).toBe(new Date(futureSec * 1000).toISOString());
  });

  it('extracts tokens and expiry from flat and nested login payloads', () => {
    const futureSec = Math.floor(Date.now() / 1000) + 900;
    const jwt = makeJwt({ exp: futureSec });

    const nestedPayload = {
      status: 'success',
      data: {
        tokens: {
          access_token: jwt,
          refresh_token: 'ref_abc123',
        },
        tenant_id: 'org_42',
        entity_id: 'usr_99',
      },
    };

    const extracted = extractTokensFromPayload(nestedPayload);
    expect(extracted).not.toBeNull();
    expect(extracted?.accessToken).toBe(jwt);
    expect(extracted?.refreshToken).toBe('ref_abc123');
    expect(extracted?.tenantId).toBe('org_42');
    expect(extracted?.entityId).toBe('usr_99');
    expect(extracted?.expiresAt).toBe(new Date(futureSec * 1000).toISOString());
  });

  it('computes expiresAt from expires_in seconds when present', () => {
    const before = Date.now();
    const extracted = extractTokensFromPayload({
      accessToken: 'opaque_token_xyz',
      refreshToken: 'refresh_xyz',
      expires_in: 600,
    });
    expect(extracted?.accessToken).toBe('opaque_token_xyz');
    expect(extracted?.refreshToken).toBe('refresh_xyz');
    const parsedExp = Date.parse(extracted?.expiresAt || '');
    expect(parsedExp).toBeGreaterThanOrEqual(before + 599_000);
  });

  it('auto-detects refresh endpoint from OpenAPI endpoint list', () => {
    const endpoints = [
      'GET /api/v1/users',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/refresh',
      'DELETE /api/v1/auth/logout',
    ];
    expect(detectRefreshEndpoint(endpoints)).toBe('/api/v1/auth/refresh');
  });

  it('merges extracted tokens into existing credentials without losing custom headers', () => {
    const merged = mergeExtractedCredentials(
      {
        accessToken: 'old_access',
        refreshToken: 'kept_refresh',
        customHeaders: { 'X-Custom': 'val' },
      },
      {
        accessToken: 'new_access',
      },
    );
    expect(merged.accessToken).toBe('new_access');
    expect(merged.refreshToken).toBe('kept_refresh');
    expect(merged.customHeaders).toEqual({ 'X-Custom': 'val' });
  });
});
