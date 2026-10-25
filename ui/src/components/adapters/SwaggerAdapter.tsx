import React, { useRef, useMemo } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import '../swagger-ui-overrides.css';
import { useQAPillInjection } from '../../lib/useQAPillInjection';
import {
  buildRequestInterceptor,
  buildResponseInterceptor,
} from '../../lib/sandboxInterceptors';
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

const SwaggerAdapter: React.FC<Props> = (props) => {
  const { specUrl, qaData, qaMode, onInspectEndpoint } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useQAPillInjection({
    containerRef,
    renderer: 'swagger',
    qaData,
    qaMode,
    onInspectEndpoint,
    specUrl,
  });

  const requestInterceptor = useMemo(
    () =>
      buildRequestInterceptor({
        credentials: props.credentials,
        onUpdateCredentials: props.onUpdateCredentials,
        mockMode: props.mockMode,
        mockScenario: props.mockScenario,
        onShowToast: props.onShowToast,
        maskPII: props.maskPII,
      }),
    [props.credentials, props.mockMode, props.mockScenario, props.maskPII],
  );

  const responseInterceptor = useMemo(
    () =>
      buildResponseInterceptor({
        credentials: props.credentials,
        onUpdateCredentials: props.onUpdateCredentials,
        mockMode: props.mockMode,
        mockScenario: props.mockScenario,
        onShowToast: props.onShowToast,
        maskPII: props.maskPII,
        containerRef,
      }),
    [props.credentials, props.onUpdateCredentials, props.onShowToast],
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
        requestInterceptor={requestInterceptor}
        responseInterceptor={responseInterceptor}
      />
    </div>
  );
};

export default SwaggerAdapter;