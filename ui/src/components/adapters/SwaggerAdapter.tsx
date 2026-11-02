import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import '../swagger-ui-overrides.css';
import { useQAPillInjection } from '../../lib/useQAPillInjection';
import {
  buildRequestInterceptor,
  buildResponseInterceptor,
} from '../../lib/sandboxInterceptors';
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

const SwaggerAdapter: React.FC<Props> = (props) => {
  const { specUrl, qaData, qaMode, onInspectEndpoint, credentials } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const swaggerSystemRef = useRef<any>(null);

  useQAPillInjection({
    containerRef,
    renderer: 'swagger',
    qaData,
    qaMode,
    onInspectEndpoint,
    specUrl,
  });

  // Sync our StoredCredentials into Swagger UI's internal auth state so lock icons
  // turn locked and Swagger's "Authorize" modal reflects the auto-captured token.
  const syncSwaggerAuth = useCallback((system: any, creds: StoredCredentials) => {
    if (!system) return;
    try {
      if (creds.accessToken && typeof system.preauthorizeApiKey === 'function') {
        const securityDefs =
          system.specSelectors?.securityDefinitions?.()?.toJS?.() || {};
        const schemeKeys = Object.keys(securityDefs);

        if (schemeKeys.length > 0) {
          for (const key of schemeKeys) {
            const def = securityDefs[key];
            const isBearer =
              def?.scheme?.toLowerCase() === 'bearer' ||
              (def?.type === 'apiKey' &&
                def?.name?.toLowerCase() === 'authorization');
            const val =
              def?.type === 'http' && def?.scheme?.toLowerCase() === 'bearer'
                ? creds.accessToken
                : isBearer
                  ? `Bearer ${creds.accessToken}`
                  : creds.accessToken;
            system.preauthorizeApiKey(key, val);
          }
        } else {
          // Common default security scheme names in OpenAPI specs
          for (const fallbackKey of ['BearerAuth', 'bearerAuth', 'Bearer', 'jwt', 'ApiKeyAuth']) {
            system.preauthorizeApiKey(fallbackKey, creds.accessToken);
          }
        }
      }
    } catch {
      // Ignore if Swagger UI internal store isn't ready yet
    }
  }, []);

  useEffect(() => {
    if (swaggerSystemRef.current) {
      syncSwaggerAuth(swaggerSystemRef.current, credentials);
    }
  }, [credentials, syncSwaggerAuth]);

  const handleComplete = useCallback(
    (system: any) => {
      swaggerSystemRef.current = system;
      syncSwaggerAuth(system, credentials);
    },
    [credentials, syncSwaggerAuth],
  );

  const requestInterceptor = useMemo(
    () =>
      buildRequestInterceptor({
        credentials: props.credentials,
        onUpdateCredentials: props.onUpdateCredentials,
        onRefreshToken: props.onRefreshToken,
        mockMode: props.mockMode,
        mockScenario: props.mockScenario,
        onShowToast: props.onShowToast,
        maskPII: props.maskPII,
      }),
    [
      props.credentials,
      props.onUpdateCredentials,
      props.onRefreshToken,
      props.mockMode,
      props.mockScenario,
      props.onShowToast,
      props.maskPII,
    ],
  );

  const responseInterceptor = useMemo(
    () =>
      buildResponseInterceptor({
        credentials: props.credentials,
        onUpdateCredentials: props.onUpdateCredentials,
        onRefreshToken: props.onRefreshToken,
        mockMode: props.mockMode,
        mockScenario: props.mockScenario,
        onShowToast: props.onShowToast,
        maskPII: props.maskPII,
        containerRef,
      }),
    [
      props.credentials,
      props.onUpdateCredentials,
      props.onRefreshToken,
      props.mockMode,
      props.mockScenario,
      props.onShowToast,
      props.maskPII,
    ],
  );

  return (
    <div ref={containerRef}>
      <SwaggerUI
        url={specUrl}
        docExpansion="list"
        persistAuthorization={true}
        displayRequestDuration={true}
        defaultModelsExpandDepth={-1}
        deepLinking={false}
        onComplete={handleComplete}
        requestInterceptor={requestInterceptor}
        responseInterceptor={responseInterceptor}
      />
    </div>
  );
};

export default SwaggerAdapter;
