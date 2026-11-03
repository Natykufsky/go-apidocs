import React, { useRef } from 'react';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import './scalar-overrides.css';
import { useQAPillInjection } from '../../lib/useQAPillInjection';
import { useTheme } from '../../context/ThemeContext';
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

const ScalarAdapter: React.FC<Props> = ({
  specUrl,
  qaData,
  qaMode,
  onInspectEndpoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useQAPillInjection({
    containerRef,
    renderer: 'scalar',
    qaData,
    qaMode,
    onInspectEndpoint,
    specUrl,
  });

  return (
    <div ref={containerRef}>
      <ApiReferenceReact
        configuration={{
          spec: { url: specUrl },
          theme: isDark ? 'moon' : 'default',
          hideDarkModeToggle: true,
          hideModels: false,
        }}
      />
    </div>
  );
};

export default ScalarAdapter;