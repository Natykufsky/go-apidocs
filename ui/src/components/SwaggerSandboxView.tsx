import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import {
  Filter,
  FlaskConical,
  FileSpreadsheet,
  KeyRound,
  CheckCircle2,
  X,
  ShieldAlert,
  Sparkles,
  GitCompare,
  CircleDot,
  ChevronRight,
} from 'lucide-react';
import { QABar, QAStats } from './QABar';
import { QARecord } from './QAReportModal';
import { StoredCredentials } from './CredentialManagerModal';
import { ErrorBoundary, LoadingFallback } from './ErrorBoundary';
import { useWorkspace } from '../context/WorkspaceContext';
import { useQA } from '../context/QAContext';
import { useEndpointDiff } from '../lib/useEndpointDiff';
import { RendererSwitcher } from './RendererSwitcher';
import {
  getRendererPreference,
  setRendererPreference,
  type RendererChoice,
} from '../lib/rendererPreference';

const LazySwagger = lazy(() => import('./adapters/SwaggerAdapter'));
const LazyScalar = lazy(() => import('./adapters/ScalarAdapter'));
const LazyStoplight = lazy(() => import('./adapters/StoplightAdapter'));

interface SwaggerSandboxViewProps {
  specUrl: string;
  activeModule: string;
  onModuleChange: (mod: string) => void;
  availableModules: string[];
  qaMode: boolean;
  onToggleQAMode: () => void;
  onOpenQAReport: () => void;
  onInspectEndpoint?: (endpoint: string) => void;
  qaStats: QAStats;
  qaData: Record<string, QARecord>;
  onUpdateQAData: (data: Record<string, QARecord>) => void;
  credentials: StoredCredentials;
  onUpdateCredentials: (creds: StoredCredentials) => void;
  onOpenCredentials: () => void;
  maskPII?: boolean;
}

/* ---------- toolbar chip (unchanged from current) ---------- */
const Chip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  title?: string;
  Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
  label: string;
  value?: string;
  valueTone?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ active = false, onClick, title, Icon, iconColor, label, value, valueTone }) => {
  const tone: Record<string, string> = {
    default: 'var(--text-secondary)',
    success: 'var(--success-500)',
    warning: 'var(--warning-500)',
    danger: 'var(--danger-500)',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] transition-colors"
      style={{
        background: active ? 'var(--accent-muted)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--accent-500) 40%, transparent)' : 'var(--border-subtle)'}`,
        color: active ? 'var(--accent-500)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" style={iconColor ? { color: iconColor } : undefined} />}
      <span className="font-medium">{label}</span>
      {value && (
        <span
          className="mono font-medium"
          style={{ color: valueTone ? tone[valueTone] : 'var(--text-tertiary)' }}
        >
          {value}
        </span>
      )}
    </button>
  );
};

export const SwaggerSandboxView: React.FC<SwaggerSandboxViewProps> = (props) => {
  const {
    specUrl,
    activeModule,
    onModuleChange,
    availableModules,
    qaMode,
    onToggleQAMode,
    onOpenQAReport,
    onInspectEndpoint,
    qaStats,
    qaData,
    credentials,
    onUpdateCredentials,
    onOpenCredentials,
    maskPII = false,
  } = props;

  const { activeWorkspaceId, activeServiceId } = useWorkspace();
  const { endpoints: allEndpoints } = useQA();
  const { diff, commitSnapshot } = useEndpointDiff(activeWorkspaceId, activeServiceId, allEndpoints);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning'>('success');
  const [renderer, setRendererState] = useState<RendererChoice>(getRendererPreference());

  const [mockMode, setMockMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apidocs_mock_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [mockScenario, setMockScenario] = useState<string>(() => {
    try {
      return localStorage.getItem('apidocs_mock_scenario') || '200';
    } catch {
      return '200';
    }
  });

  const showToast = useCallback((msg: string, type: 'success' | 'warning' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleRendererChange = (r: RendererChoice) => {
    setRendererState(r);
    setRendererPreference(r);
  };

  const handleScenarioChange = (scenario: string) => {
    setMockScenario(scenario);
    try {
      localStorage.setItem('apidocs_mock_scenario', scenario);
    } catch { }
    showToast(`Mock scenario: ${scenario}`, 'success');
  };

  const toggleMockMode = () => {
    const next = !mockMode;
    setMockMode(next);
    try {
      localStorage.setItem('apidocs_mock_mode', String(next));
    } catch { }
    showToast(
      next
        ? 'Mock engine active — requests simulate at /docs/mock'
        : 'Live API mode — requests hit real endpoints',
      'success',
    );
  };

  const hasActiveCreds = !!(
    credentials.accessToken ||
    credentials.tenantId ||
    credentials.entityId ||
    (credentials.customHeaders && Object.keys(credentials.customHeaders).length > 0)
  );

  const sharedProps = {
    specUrl,
    credentials,
    onUpdateCredentials,
    mockMode,
    mockScenario,
    qaData,
    qaMode,
    onInspectEndpoint,
    onShowToast: showToast,
    maskPII,
  };

  return (
    <div className="flex-1 flex flex-col">
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--r-md)] text-[12.5px]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--e2)',
            color: 'var(--text-primary)',
            minWidth: 260,
          }}
        >
          {toastType === 'warning' ? (
            <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: 'var(--warning-500)' }} />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--success-500)' }} />
          )}
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {availableModules.length > 0 && (
              <div
                className="flex items-center gap-1.5 h-8 px-2 rounded-[var(--r-sm)] text-[12px]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Filter className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <span className="font-medium hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>
                  Scope
                </span>
                <select
                  value={activeModule}
                  onChange={(e) => onModuleChange(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer text-[12px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <option value="all">All endpoints</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <RendererSwitcher value={renderer} onChange={handleRendererChange} />

            <Chip
              Icon={hasActiveCreds ? CircleDot : KeyRound}
              iconColor={hasActiveCreds ? 'var(--success-500)' : undefined}
              label="Auth"
              value={hasActiveCreds ? 'set' : 'none'}
              valueTone={hasActiveCreds ? 'success' : 'default'}
              onClick={onOpenCredentials}
              title="Inspect tokens and custom headers"
            />

            <Chip
              Icon={Sparkles}
              iconColor={mockMode ? 'var(--accent-500)' : undefined}
              label="Mock"
              value={mockMode ? 'on' : 'off'}
              valueTone={mockMode ? 'success' : 'default'}
              active={mockMode}
              onClick={toggleMockMode}
              title={mockMode ? 'Mock engine active' : 'Activate mock engine'}
            />

            {mockMode && renderer === 'swagger' && (
              <select
                value={mockScenario}
                onChange={(e) => handleScenarioChange(e.target.value)}
                className="h-8 px-2 rounded-[var(--r-sm)] text-[12px] outline-none cursor-pointer"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="200">200 OK</option>
                <option value="401">401 Unauthorized</option>
                <option value="403">403 Forbidden</option>
                <option value="429">429 Rate limit</option>
                <option value="500">500 Server error</option>
                <option value="503">503 Unavailable</option>
                <option value="slow">Slow (2s)</option>
              </select>
            )}

            <Chip
              Icon={FlaskConical}
              label="QA"
              value={qaMode ? 'on' : 'off'}
              valueTone={qaMode ? 'success' : 'default'}
              active={qaMode}
              onClick={onToggleQAMode}
              title="Toggle QA mode"
            />

            <Chip
              Icon={FileSpreadsheet}
              label="Report"
              onClick={onOpenQAReport}
              title="Open QA report"
            />
          </div>
        </div>
      </div>

      {qaMode && <QABar stats={qaStats} />}

      {qaMode && (diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-3">
          <div
            className="flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] px-3 py-2 text-[12px]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            <GitCompare className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--warning-500)' }} />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Spec changed since last QA run
            </span>
            <span className="mono">+{diff.added.length}</span>
            <span className="mono">−{diff.removed.length}</span>
            <button
              onClick={commitSnapshot}
              className="ml-auto h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
              style={{ background: 'var(--accent-500)', color: 'var(--text-inverse)' }}
            >
              Mark reviewed
            </button>
          </div>
        </div>
      )}

      {/* Renderer mount */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* QA badge — shown above Scalar because it can't show inline pills */}
        {renderer === 'scalar' && qaMode && (
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--r-md)] mb-3"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <FlaskConical
                className="w-3.5 h-3.5"
                style={{ color: 'var(--accent-500)' }}
              />
              <span
                className="text-[11.5px] font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                QA
              </span>
            </div>

            <div className="flex items-center gap-3 mono text-[11.5px]">
              <span style={{ color: 'var(--text-secondary)' }}>
                {qaStats.passed + qaStats.retest + qaStats.failed} / {qaStats.total} tested
              </span>
              {qaStats.passed > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--success-500)' }}
                  />
                  <span style={{ color: 'var(--success-500)' }}>{qaStats.passed} passed</span>
                </span>
              )}
              {qaStats.failed > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--danger-500)' }}
                  />
                  <span style={{ color: 'var(--danger-500)' }}>{qaStats.failed} failed</span>
                </span>
              )}
              {qaStats.retest > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--warning-500)' }}
                  />
                  <span style={{ color: 'var(--warning-500)' }}>{qaStats.retest} retest</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenQAReport}
              className="ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = 'var(--border-default)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-canvas)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              Open report
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        <div
          className="rounded-[var(--r-md)] p-4 sm:p-6"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              {renderer === 'swagger' && <LazySwagger {...sharedProps} />}
              {renderer === 'scalar' && <LazyScalar {...sharedProps} />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};