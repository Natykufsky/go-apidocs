import { describe, it, expect, vi } from 'vitest';
import {
  isInternalPortalEndpoint,
  buildRequestInterceptor,
} from './sandboxInterceptors';
import type { StoredCredentials } from '../context/AuthContext';

describe('sandboxInterceptors - isInternalPortalEndpoint', () => {
  it('identifies internal documentation portal routes', () => {
    expect(isInternalPortalEndpoint('/docs/swagger.json')).toBe(true);
    expect(isInternalPortalEndpoint('/docs/swagger.json?ws=default&svc=default')).toBe(true);
    expect(isInternalPortalEndpoint('/swagger/swagger.json')).toBe(true);
    expect(isInternalPortalEndpoint('/swagger.json')).toBe(true);
    expect(isInternalPortalEndpoint('/docs/workspaces')).toBe(true);
    expect(isInternalPortalEndpoint('/docs/qa/data')).toBe(true);
    expect(isInternalPortalEndpoint('/docs/nav')).toBe(true);
    expect(isInternalPortalEndpoint('http://localhost:8080/docs/swagger.json?ws=crm')).toBe(true);
  });

  it('allows external user application API routes', () => {
    expect(isInternalPortalEndpoint('/api/v1/users')).toBe(false);
    expect(isInternalPortalEndpoint('/api/v1/auth/login')).toBe(false);
    expect(isInternalPortalEndpoint('https://api.example.com/v2/orders')).toBe(false);
  });
});

describe('sandboxInterceptors - buildRequestInterceptor', () => {
  const dummyCreds: StoredCredentials = {
    accessToken: 'sample-jwt-access-token',
    refreshToken: 'sample-refresh-token',
    tenantId: 'tenant-123',
  };

  it('strips authorization headers and does not inject API tokens on /docs/swagger.json', async () => {
    const interceptor = buildRequestInterceptor({
      credentials: dummyCreds,
      onUpdateCredentials: vi.fn(),
      onShowToast: vi.fn(),
      mockMode: true,
      mockScenario: '200',
      maskPII: false,
    });

    const req = {
      url: '/docs/swagger.json?ws=default&svc=default',
      headers: {
        Authorization: 'Bearer stale-persisted-app-token',
        'X-Tenant-ID': 'stale-tenant',
      },
    };

    const result = await interceptor(req);

    expect(result.url).toBe('/docs/swagger.json?ws=default&svc=default');
    expect(result.headers.Authorization).toBeUndefined();
    expect(result.headers['X-Tenant-ID']).toBeUndefined();
  });

  it('injects credentials into regular application endpoints', async () => {
    const interceptor = buildRequestInterceptor({
      credentials: dummyCreds,
      onUpdateCredentials: vi.fn(),
      onShowToast: vi.fn(),
      mockMode: false,
      mockScenario: '200',
      maskPII: false,
    });

    const req = {
      url: '/api/v1/dashboard/stats',
      headers: {},
    };

    const result = await interceptor(req);

    expect(result.headers.Authorization).toBe('Bearer sample-jwt-access-token');
    expect(result.headers['X-Tenant-ID']).toBe('tenant-123');
  });
});

