import React, { useRef, useEffect } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import './scalar-overrides.css';
import { useQAPillInjection } from '../../lib/useQAPillInjection';
import { useTheme } from '../../context/ThemeContext';
import { inspectAndCaptureResponsePayload } from '../../lib/sandboxInterceptors';
import type { QARecord } from '../QAReportModal';
import type { StoredCredentials } from '../../context/AuthContext';

interface Props {
  specUrl: string;
  credentials: StoredCredentials;
  onUpdateCredentials: (c: StoredCredentials) => void;
  onRefreshToken?: () => Promise<StoredCredentials | null>;
  mockMode: boolean;
  mockScenario: string;
  qaData: Record<string, QARecord>;
  qaMode: boolean;
  onInspectEndpoint?: (key: string) => void;
  onShowToast: (msg: string, kind: 'success' | 'warning') => void;
  maskPII: boolean;
}

const isTokenExpiredOrSoon = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t - Date.now() < 30_000;
};

const ScalarAdapter: React.FC<Props> = ({
  specUrl,
  credentials,
  onUpdateCredentials,
  onRefreshToken,
  mockMode,
  mockScenario,
  qaData,
  qaMode,
  onInspectEndpoint,
  onShowToast,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Keep latest values in a ref so the fetch interceptor always reads fresh state
  // without tearing down and re-wrapping `window.fetch` on every render.
  const latestRef = useRef({
    credentials,
    onUpdateCredentials,
    onRefreshToken,
    mockMode,
    mockScenario,
    onShowToast,
    specUrl,
  });
  useEffect(() => {
    latestRef.current = {
      credentials,
      onUpdateCredentials,
      onRefreshToken,
      mockMode,
      mockScenario,
      onShowToast,
      specUrl,
    };
  }, [
    credentials,
    onUpdateCredentials,
    onRefreshToken,
    mockMode,
    mockScenario,
    onShowToast,
    specUrl,
  ]);

  useQAPillInjection({
    containerRef,
    renderer: 'scalar',
    qaData,
    qaMode,
    onInspectEndpoint,
    specUrl,
  });

  // Intercept `window.fetch` while Scalar is mounted so Scalar's "Test Request"
  // client automatically injects stored credentials, auto-captures login tokens,
  // and silently retries on 401 Unauthorized using the stored refresh token.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const state = latestRef.current;
      let rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      // Do not intercept internal portal API requests (spec load, QA records, workspaces)
      const isInternalPortalCall =
        rawUrl.includes('/docs/swagger.json') ||
        rawUrl.includes('/docs/qa/') ||
        rawUrl.includes('/docs/workspaces') ||
        rawUrl.includes('/docs/capabilities') ||
        rawUrl.includes('/docs/nav');

      if (isInternalPortalCall) {
        return originalFetch(input, init);
      }

      let activeCreds = state.credentials;
      const isRefreshCall =
        activeCreds.refreshEndpoint &&
        rawUrl.includes(activeCreds.refreshEndpoint);

      // Proactive pre-request refresh if expired or expiring within 30s
      if (
        !isRefreshCall &&
        activeCreds.autoRefresh !== false &&
        activeCreds.refreshToken &&
        state.onRefreshToken &&
        (!activeCreds.accessToken || isTokenExpiredOrSoon(activeCreds.expiresAt))
      ) {
        const refreshed = await state.onRefreshToken();
        if (refreshed && refreshed.accessToken) {
          activeCreds = refreshed;
          state.onShowToast('Access token auto-refreshed before request', 'success');
        }
      }

      // Mock engine routing
      let targetInput: RequestInfo | URL = input;
      if (state.mockMode && rawUrl) {
        try {
          const u = new URL(rawUrl, window.location.origin);
          if (!u.pathname.startsWith('/docs/mock')) {
            u.pathname = `/docs/mock${u.pathname.startsWith('/') ? u.pathname : '/' + u.pathname}`;
            targetInput = u.toString();
          }
        } catch {
          if (!rawUrl.startsWith('/docs/mock')) {
            targetInput = `/docs/mock${rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl}`;
          }
        }
      }

      const buildHeaders = (creds: StoredCredentials): Headers => {
        const h = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
        if (state.mockMode && state.mockScenario && state.mockScenario !== '200') {
          h.set('X-Mock-Scenario', state.mockScenario);
        }
        if (creds.accessToken && !h.has('Authorization')) {
          h.set('Authorization', `Bearer ${creds.accessToken}`);
        }
        if (creds.tenantId && !h.has('X-Tenant-ID')) {
          h.set('X-Tenant-ID', creds.tenantId);
        }
        if (creds.entityId && !h.has('X-Entity-ID')) {
          h.set('X-Entity-ID', creds.entityId);
        }
        if (creds.refreshToken && !h.has('X-Refresh-Token')) {
          h.set('X-Refresh-Token', creds.refreshToken);
        }
        if (creds.customHeaders) {
          for (const [k, v] of Object.entries(creds.customHeaders)) {
            if (k && v && !h.has(k)) h.set(k, v);
          }
        }
        return h;
      };

      let response = await originalFetch(targetInput, {
        ...init,
        headers: buildHeaders(activeCreds),
      });

      // Reactive 401 retry: if unauthorized and we have a refresh token, refresh and retry once!
      if (
        response.status === 401 &&
        !isRefreshCall &&
        activeCreds.autoRefresh !== false &&
        activeCreds.refreshToken &&
        state.onRefreshToken
      ) {
        const refreshed = await state.onRefreshToken();
        if (refreshed && refreshed.accessToken) {
          state.onShowToast('401 intercepted — token refreshed & request retried', 'success');
          const retryHeaders = buildHeaders(refreshed);
          retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
          response = await originalFetch(targetInput, {
            ...init,
            headers: retryHeaders,
          });
        }
      }

      // Clone response to inspect body for login tokens without consuming Scalar's stream
      try {
        const cloned = response.clone();
        cloned
          .text()
          .then((rawText) => {
            if (!rawText) return;
            inspectAndCaptureResponsePayload({
              status: response.status,
              rawText,
              credentials: latestRef.current.credentials,
              onUpdateCredentials: latestRef.current.onUpdateCredentials,
              onShowToast: latestRef.current.onShowToast,
            });
          })
          .catch(() => {});
      } catch {
        // Ignore if response cannot be cloned
      }

      return response;
    };

    window.fetch = wrappedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div ref={containerRef}>
      <ApiReferenceReact
        configuration={{
          spec: { url: specUrl },
          theme: isDark ? 'moon' : 'default',
          hideDarkModeToggle: true,
          hideModels: false,
          authentication: credentials.accessToken
            ? {
                http: {
                  basic: {
                    username: '',
                    password: '',
                  },
                  bearer: {
                    token: credentials.accessToken,
                  },
                },
                apiKey: {
                  token: credentials.accessToken,
                },
              }
            : undefined,
        }}
      />
    </div>
  );
};

export default ScalarAdapter;
