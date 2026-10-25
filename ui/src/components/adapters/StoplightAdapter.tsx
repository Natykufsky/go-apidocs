import React, { useRef, useEffect, useMemo } from 'react';
import { API } from '@stoplight/elements';
import '@stoplight/elements/styles.min.css';
import './stoplight-overrides.css';
import { useQAPillInjection } from '../../lib/useQAPillInjection';
import { scrollToLastResponse } from '../../lib/scrollToResponse';
import type { QARecord } from '../QAReportModal';
import type { StoredCredentials } from '../CredentialManagerModal';

interface Props {
  specUrl: string;
  credentials: StoredCredentials;
  onUpdateCredentials: (c: StoredCredentials) => void;
  mockMode: boolean;
  mockScenario: string;
  qaData: Record<string, QARecord>;
  qaMode: boolean;
  onInspectEndpoint?: (key: string) => void;
  onShowToast: (msg: string, kind: 'success' | 'warning') => void;
  maskPII: boolean;
}

const StoplightAdapter: React.FC<Props> = (props) => {
  const { specUrl, qaData, qaMode, onInspectEndpoint, credentials } = props;
  const containerRef = useRef<HTMLDivElement>(null);

//   useQAPillInjection({
//     containerRef,
//     renderer: 'stoplight',
//     qaData,
//     qaMode,
//     onInspectEndpoint,
//     specUrl,
//   });

  // Stoplight has no built-in interceptor API. Wrap fetch to inject auth
  // headers on Try It requests. Response-side handling is limited — we
  // can't reliably capture response bodies without deep hooks, so we
  // disable auto-capture and PII detection for this renderer.
  const customFetch = useMemo<typeof fetch>(() => {
    return async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const headers = new Headers(init?.headers || {});
      if (credentials.accessToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${credentials.accessToken}`);
      }
      if (credentials.tenantId && !headers.has('X-Tenant-ID')) {
        headers.set('X-Tenant-ID', credentials.tenantId);
      }
      if (credentials.entityId && !headers.has('X-Entity-ID')) {
        headers.set('X-Entity-ID', credentials.entityId);
      }
      if (credentials.customHeaders) {
        for (const [k, v] of Object.entries(credentials.customHeaders)) {
          if (k && v && !headers.has(k)) headers.set(k, v);
        }
      }
      const response = await fetch(input, { ...init, headers });
      scrollToLastResponse(containerRef.current);
      return response;
    };
  }, [credentials]);

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