import React, { useRef, useEffect, useMemo } from 'react';
import { API } from '@stoplight/elements';
import '@stoplight/elements/styles.min.css';
import './stoplight-overrides.css';
import { scrollToLastResponse } from '../../lib/scrollToResponse';
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

const StoplightAdapter: React.FC<Props> = (props) => {
  const {
    specUrl,
    credentials,
    onUpdateCredentials,
    onRefreshToken,
    onShowToast,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  const customFetch = useMemo<typeof fetch>(() => {
    return async (input, init) => {
      const buildHeaders = (creds: StoredCredentials) => {
        const headers = new Headers(init?.headers || {});
        if (creds.accessToken && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${creds.accessToken}`);
        }
        if (creds.tenantId && !headers.has('X-Tenant-ID')) {
          headers.set('X-Tenant-ID', creds.tenantId);
        }
        if (creds.entityId && !headers.has('X-Entity-ID')) {
          headers.set('X-Entity-ID', creds.entityId);
        }
        if (creds.refreshToken && !headers.has('X-Refresh-Token')) {
          headers.set('X-Refresh-Token', creds.refreshToken);
        }
        if (creds.customHeaders) {
          for (const [k, v] of Object.entries(creds.customHeaders)) {
            if (k && v && !headers.has(k)) headers.set(k, v);
          }
        }
        return headers;
      };

      let response = await fetch(input, {
        ...init,
        headers: buildHeaders(credentials),
      });

      if (
        response.status === 401 &&
        credentials.autoRefresh !== false &&
        credentials.refreshToken &&
        onRefreshToken
      ) {
        const refreshed = await onRefreshToken();
        if (refreshed && refreshed.accessToken) {
          onShowToast('401 intercepted — token refreshed & request retried', 'success');
          const retryHeaders = buildHeaders(refreshed);
          retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
          response = await fetch(input, { ...init, headers: retryHeaders });
        }
      }

      try {
        const cloned = response.clone();
        cloned
          .text()
          .then((rawText) => {
            if (!rawText) return;
            inspectAndCaptureResponsePayload({
              status: response.status,
              rawText,
              credentials,
              onUpdateCredentials,
              onShowToast,
            });
          })
          .catch(() => {});
      } catch {
        // ignore
      }

      scrollToLastResponse(containerRef.current);
      return response;
    };
  }, [credentials, onUpdateCredentials, onRefreshToken, onShowToast]);

  // Stoplight's sidebar layout sometimes needs a nudge on mobile
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      root.classList.toggle('stoplight-mobile', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div ref={containerRef}>
      <API
        apiDescriptionUrl={specUrl}
        layout="sidebar"
        router="hash"
        tryItCredentialsPolicy="include"
        tryItCorsProxy={false}
        httpClient={customFetch}
      />
    </div>
  );
};

export default StoplightAdapter;
