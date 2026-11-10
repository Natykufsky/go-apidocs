import type { StoredCredentials } from '../context/AuthContext';
import {
  extractTokensFromPayload,
  mergeExtractedCredentials,
} from './tokenUtils';

interface Params {
  credentials: StoredCredentials;
  onUpdateCredentials: (c: StoredCredentials) => void;
  onRefreshToken?: () => Promise<StoredCredentials | null>;
  mockMode: boolean;
  mockScenario: string;
  onShowToast: (msg: string, kind: 'success' | 'warning') => void;
  maskPII: boolean;
}

const isTokenExpiredOrSoon = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t - Date.now() < 30_000;
};

export const applyAuthHeaders = (
  headers: Record<string, string>,
  creds: StoredCredentials,
) => {
  const { accessToken, refreshToken, tenantId, entityId, customHeaders } = creds;
  if (accessToken && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId && !headers['X-Tenant-ID'] && !headers['x-tenant-id']) {
    headers['X-Tenant-ID'] = tenantId;
  }
  if (entityId && !headers['X-Entity-ID'] && !headers['x-entity-id']) {
    headers['X-Entity-ID'] = entityId;
  }
  if (refreshToken && !headers['X-Refresh-Token'] && !headers['x-refresh-token']) {
    headers['X-Refresh-Token'] = refreshToken;
  }
  if (customHeaders) {
    for (const [k, v] of Object.entries(customHeaders)) {
      if (k && v && !headers[k]) headers[k] = v;
    }
  }
};

export const isInternalPortalEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.includes('/docs/swagger.json') ||
    url.includes('/swagger/swagger.json') ||
    url.includes('/swagger.json') ||
    url.includes('/docs/workspaces') ||
    url.includes('/docs/qa/') ||
    url.includes('/docs/capabilities') ||
    url.includes('/docs/nav') ||
    url.includes('/docs/readme') ||
    url.includes('/docs/markdown-docs')
  );
};

export const buildRequestInterceptor = ({
  credentials,
  onRefreshToken,
  mockMode,
  mockScenario,
  onShowToast,
}: Params) => async (req: any) => {
  if (!req.headers) req.headers = {};

  // Defense-in-depth: Never inject API credentials or mock routing into internal portal endpoints
  // (e.g. spec loading, workspaces list, nav, QA). Strip any persisted Authorization headers
  // that Swagger UI might attempt to forward during spec fetch.
  if (isInternalPortalEndpoint(req.url)) {
    if (req.headers.Authorization) delete req.headers.Authorization;
    if (req.headers.authorization) delete req.headers.authorization;
    if (req.headers['X-Tenant-ID']) delete req.headers['X-Tenant-ID'];
    if (req.headers['x-tenant-id']) delete req.headers['x-tenant-id'];
    return req;
  }

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

  let activeCreds = credentials;

  // Pre-request silent refresh if token is expired or about to expire (<30s)
  // and a refreshToken is available (avoid recursion if this request IS the refresh endpoint)
  const isRefreshCall =
    req.url &&
    credentials.refreshEndpoint &&
    String(req.url).includes(credentials.refreshEndpoint);

  if (
    !isRefreshCall &&
    credentials.autoRefresh !== false &&
    credentials.refreshToken &&
    onRefreshToken &&
    (!credentials.accessToken || isTokenExpiredOrSoon(credentials.expiresAt))
  ) {
    const refreshed = await onRefreshToken();
    if (refreshed && refreshed.accessToken) {
      activeCreds = refreshed;
      onShowToast('Access token auto-refreshed before request', 'success');
    }
  }

  applyAuthHeaders(req.headers, activeCreds);
  return req;
};

export const inspectAndCaptureResponsePayload = ({
  status,
  rawText,
  parsedBody,
  credentials,
  onUpdateCredentials,
  onShowToast,
}: {
  status: number;
  rawText: string;
  parsedBody?: unknown;
  credentials: StoredCredentials;
  onUpdateCredentials: (c: StoredCredentials) => void;
  onShowToast: (msg: string, kind: 'success' | 'warning') => void;
}) => {
  if (/AKIA[0-9A-Z]{16}/.test(rawText)) {
    onShowToast('Security alert: possible AWS access key in response payload', 'warning');
  } else if (/-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/.test(rawText)) {
    onShowToast('Critical: private key detected in response payload', 'warning');
  } else if (/(sql:\s*no\s*rows|pq:\s*relation|syntax\s*error\s*at\s*or\s*near)/i.test(rawText)) {
    onShowToast('Debug info leak: database error exposed in response', 'warning');
  }

  if (status === 200 || status === 201) {
    let body = parsedBody;
    if (!body && rawText) {
      try {
        body = JSON.parse(rawText);
      } catch {
        // non-JSON response
      }
    }
    const extracted = extractTokensFromPayload(body);
    if (extracted) {
      const updated = mergeExtractedCredentials(credentials, extracted);
      onUpdateCredentials(updated);

      const captured: string[] = [];
      if (extracted.accessToken) captured.push('access token');
      if (extracted.refreshToken) captured.push('refresh token');
      if (extracted.tenantId) captured.push(`tenant ${extracted.tenantId}`);
      if (extracted.entityId) captured.push(`entity ${extracted.entityId}`);
      if (captured.length > 0) {
        onShowToast(`Auto-saved: ${captured.join(', ')}`, 'success');
      }
    }
  }
};

export const buildResponseInterceptor = ({
  credentials,
  onUpdateCredentials,
  onRefreshToken,
  onShowToast,
  containerRef,
}: Params & { containerRef: React.RefObject<HTMLElement> }) => async (res: any) => {
  if (res) {
    // Reactive 401 handler: trigger silent token renewal so the token is ready immediately
    if (
      res.status === 401 &&
      credentials.autoRefresh !== false &&
      credentials.refreshToken &&
      onRefreshToken
    ) {
      const refreshed = await onRefreshToken();
      if (refreshed && refreshed.accessToken) {
        onShowToast('401 detected — token auto-refreshed! Re-run or continue.', 'success');
      } else {
        onShowToast('401 Unauthorized — auto-refresh failed or refresh token expired', 'warning');
      }
    }

    if (res.data) {
      try {
        const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        inspectAndCaptureResponsePayload({
          status: res.status,
          rawText: raw,
          parsedBody: parsed,
          credentials,
          onUpdateCredentials,
          onShowToast,
        });
      } catch {
        // ignore non-JSON
      }
    }
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
