import type { StoredCredentials } from '../components/CredentialManagerModal';

interface Params {
  credentials: StoredCredentials;
  onUpdateCredentials: (c: StoredCredentials) => void;
  mockMode: boolean;
  mockScenario: string;
  onShowToast: (msg: string, kind: 'success' | 'warning') => void;
  maskPII: boolean;
}

export const buildRequestInterceptor = ({
  credentials,
  mockMode,
  mockScenario,
}: Params) => (req: any) => {
  if (!req.headers) req.headers = {};

  // Mock engine routing
  if (mockMode && req.url) {
    try {
      const u = new URL(req.url, window.location.origin);
      if (!u.pathname.startsWith('/docs/mock')) {
        u.pathname = `/docs/mock${u.pathname.startsWith('/') ? u.pathname : '/' + u.pathname}`;
        req.url = u.toString();
      }
    } catch {
      if (!req.url.startsWith('/docs/mock')) {
        req.url = `/docs/mock${req.url.startsWith('/') ? req.url : '/' + req.url}`;
      }
    }
    if (mockScenario && mockScenario !== '200') {
      req.headers['X-Mock-Scenario'] = mockScenario;
    }
  }

  // Auth injection
  const { accessToken, refreshToken, tenantId, entityId, customHeaders } = credentials;
  if (accessToken && !req.headers.Authorization && !req.headers.authorization) {
    req.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId && !req.headers['X-Tenant-ID'] && !req.headers['x-tenant-id']) {
    req.headers['X-Tenant-ID'] = tenantId;
  }
  if (entityId && !req.headers['X-Entity-ID'] && !req.headers['x-entity-id']) {
    req.headers['X-Entity-ID'] = entityId;
  }
  if (refreshToken && !req.headers['X-Refresh-Token'] && !req.headers['x-refresh-token']) {
    req.headers['X-Refresh-Token'] = refreshToken;
  }
  if (customHeaders) {
    for (const [k, v] of Object.entries(customHeaders)) {
      if (k && v && !req.headers[k]) req.headers[k] = v;
    }
  }
  return req;
};

export const buildResponseInterceptor = ({
  credentials,
  onUpdateCredentials,
  onShowToast,
  containerRef,
}: Params & { containerRef: React.RefObject<HTMLElement> }) => (res: any) => {
  if (res && res.data) {
    try {
      const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (/AKIA[0-9A-Z]{16}/.test(raw)) {
        onShowToast('Security alert: possible AWS access key in response payload', 'warning');
      } else if (/-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/.test(raw)) {
        onShowToast('Critical: private key detected in response payload', 'warning');
      } else if (/(sql:\s*no\s*rows|pq:\s*relation|syntax\s*error\s*at\s*or\s*near)/i.test(raw)) {
        onShowToast('Debug info leak: database error exposed in response', 'warning');
      }

      if (res.status === 200 || res.status === 201) {
        const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (body && typeof body === 'object') {
          const c = body.data || body.payload || body.result || body;
          const accessToken = c.access_token || c.accessToken || c.token || c.jwt || c.bearer_token;
          const refreshToken = c.refresh_token || c.refreshToken;
          const tenantId = c.tenant_id || c.tenantId || c.tenant;
          const entityId = c.entity_id || c.entityId || c.entity;
          if (accessToken || refreshToken || tenantId || entityId) {
            onUpdateCredentials({
              ...credentials,
              accessToken: accessToken || credentials.accessToken,
              refreshToken: refreshToken || credentials.refreshToken,
              tenantId: tenantId ? String(tenantId) : credentials.tenantId,
              entityId: entityId ? String(entityId) : credentials.entityId,
              updatedAt: new Date().toLocaleTimeString(),
            });
            const captured: string[] = [];
            if (accessToken) captured.push('access token');
            if (refreshToken) captured.push('refresh token');
            if (tenantId) captured.push(`tenant ${tenantId}`);
            if (entityId) captured.push(`entity ${entityId}`);
            onShowToast(`Captured: ${captured.join(', ')}`, 'success');
          }
        }
      }
    } catch {}
  }

  // Auto-scroll to the freshly rendered response
  const root = containerRef.current;
  if (root) {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const tables = root.querySelectorAll('.live-responses-table');
        const target =
          tables.length > 0
            ? (tables[tables.length - 1] as HTMLElement)
            : (root.querySelector('.opblock.is-open .responses-wrapper') as HTMLElement | null);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    });
  }
  return res;
};