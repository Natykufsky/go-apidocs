import React, { useEffect, useState, useCallback } from 'react';
import { Navbar, NavConfig } from './components/Navbar';
import { QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';
import { QAInspectModal } from './components/QAInspectModal';
import { SpotlightSearchModal } from './components/SpotlightSearchModal';
import { CredentialManagerModal, StoredCredentials } from './components/CredentialManagerModal';
import { CodeSnippetModal } from './components/CodeSnippetModal';
import { SchemaImporterModal } from './components/SchemaImporterModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { Workspace } from './components/WorkspaceSwitcher';
import { LoginView } from './components/LoginView';
import { GuideView } from './components/GuideView';
import { LandingView } from './components/LandingView';
import { HealthView } from './components/HealthView';
import { SwaggerSandboxView } from './components/SwaggerSandboxView';

interface Capabilities {
  workspaces_enabled: boolean;
  workspace_writes_enabled: boolean;
  security_audit_enabled: boolean;
  remote_fetch_enabled: boolean;
  max_spec_bytes: number;
}

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [navConfig, setNavConfig] = useState<NavConfig>({
    title: 'API Documentation',
    subtitle: 'Developer Portal & Sandbox',
    icon: '⚡',
    nav_items: [
      { label: 'Home', url: '/', icon: '🏠' },
      { label: 'Guide', url: '/guide', icon: '📖' },
      { label: 'API Sandbox', url: '/docs', icon: '⚡' },
      { label: 'Health', url: '/dashboard', icon: '📊' },
      { label: 'OpenAPI Spec', url: '/docs/swagger.json', icon: '📄', is_button: true },
    ],
  });

  const [capabilities, setCapabilities] = useState<Capabilities>({
    workspaces_enabled: true,
    workspace_writes_enabled: false,
    security_audit_enabled: false,
    remote_fetch_enabled: false,
    max_spec_bytes: 5 * 1024 * 1024,
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'default',
      name: 'Default Workspace',
      icon: '📁',
      services: [
        {
          id: 'default',
          title: 'Main API',
          version: '1.0.0',
          icon: '⚡',
        },
      ],
    },
  ]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ws') || localStorage.getItem('apidocs_active_ws') || 'default';
  });

  const [activeServiceId, setActiveServiceId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('svc') || localStorage.getItem('apidocs_active_svc') || 'default';
  });

  const [activeModule, setActiveModule] = useState<string>('all');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [qaMode, setQAMode] = useState<boolean>(true);
  const [qaData, setQAData] = useState<Record<string, QARecord>>({});
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState<boolean>(false);
  const [isImporterModalOpen, setIsImporterModalOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [inspectEndpoint, setInspectEndpoint] = useState<string | null>(null);
  const [snippetEndpoint, setSnippetEndpoint] = useState<string | null>(null);
  const [specUrl, setSpecUrl] = useState<string>('/docs/swagger.json');
  const [allEndpointsList, setAllEndpointsList] = useState<string[]>([]);

  // Stored Credentials state synced with localStorage
  const [credentials, setCredentials] = useState<StoredCredentials>(() => {
    try {
      const access = localStorage.getItem('apidocs_access_token') || undefined;
      const refresh = localStorage.getItem('apidocs_refresh_token') || undefined;
      const tenant = localStorage.getItem('apidocs_tenant_id') || undefined;
      const entity = localStorage.getItem('apidocs_entity_id') || undefined;
      const updated = localStorage.getItem('apidocs_creds_updated_at') || undefined;
      const customHeadersStr = localStorage.getItem('apidocs_custom_headers');
      const customHeaders = customHeadersStr ? JSON.parse(customHeadersStr) : undefined;
      return {
        accessToken: access,
        refreshToken: refresh,
        tenantId: tenant,
        entityId: entity,
        customHeaders,
        updatedAt: updated,
      };
    } catch {
      return {};
    }
  });

  const handleUpdateCredentials = (creds: StoredCredentials) => {
    setCredentials(creds);
    try {
      if (creds.accessToken) localStorage.setItem('apidocs_access_token', creds.accessToken);
      else localStorage.removeItem('apidocs_access_token');

      if (creds.refreshToken) localStorage.setItem('apidocs_refresh_token', creds.refreshToken);
      else localStorage.removeItem('apidocs_refresh_token');

      if (creds.tenantId) localStorage.setItem('apidocs_tenant_id', creds.tenantId);
      else localStorage.removeItem('apidocs_tenant_id');

      if (creds.entityId) localStorage.setItem('apidocs_entity_id', creds.entityId);
      else localStorage.removeItem('apidocs_entity_id');

      if (creds.customHeaders && Object.keys(creds.customHeaders).length > 0) {
        localStorage.setItem('apidocs_custom_headers', JSON.stringify(creds.customHeaders));
      } else {
        localStorage.removeItem('apidocs_custom_headers');
      }

      if (creds.updatedAt) localStorage.setItem('apidocs_creds_updated_at', creds.updatedAt);
      else localStorage.removeItem('apidocs_creds_updated_at');
    } catch (e) {}
  };

  const handleClearCredentials = () => {
    setCredentials({});
    try {
      localStorage.removeItem('apidocs_access_token');
      localStorage.removeItem('apidocs_refresh_token');
      localStorage.removeItem('apidocs_tenant_id');
      localStorage.removeItem('apidocs_entity_id');
      localStorage.removeItem('apidocs_custom_headers');
      localStorage.removeItem('apidocs_creds_updated_at');
    } catch (e) {}
  };

  // Fetch capabilities from backend
  useEffect(() => {
    fetch('/docs/capabilities')
      .then((res) => res.json())
      .then((data: Capabilities) => {
        if (data) setCapabilities(data);
      })
      .catch(() => {});
  }, []);

  // Fetch workspaces list from backend
  const refreshWorkspaces = useCallback(() => {
    fetch('/docs/workspaces')
      .then((res) => res.json())
      .then((data: Workspace[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaces(data);
          // Auto-select if active is missing
          const wsExists = data.some((w) => w.id === activeWorkspaceId);
          if (!wsExists && data[0]) {
            setActiveWorkspaceId(data[0].id);
            if (data[0].services[0]) {
              setActiveServiceId(data[0].services[0].id);
            }
          }
        }
      })
      .catch(() => {});
  }, [activeWorkspaceId]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Compute Spec URL based on active workspace and service
  const updateSpecUrl = useCallback((ws: string, svc: string, mod: string) => {
    let url = `/docs/swagger.json?ws=${encodeURIComponent(ws)}&svc=${encodeURIComponent(svc)}`;
    if (mod && mod !== 'all' && mod !== 'imported') {
      url += `&module=${encodeURIComponent(mod)}`;
    }
    setSpecUrl(url);
  }, []);

  // Handle Workspace & Service Selection
  const handleSelectService = (wsId: string, svcId: string) => {
    setActiveWorkspaceId(wsId);
    setActiveServiceId(svcId);
    try {
      localStorage.setItem('apidocs_active_ws', wsId);
      localStorage.setItem('apidocs_active_svc', svcId);
    } catch (e) {}

    const url = new URL(window.location.href);
    url.searchParams.set('ws', wsId);
    url.searchParams.set('svc', svcId);
    window.history.pushState(null, '', url.toString());

    updateSpecUrl(wsId, svcId, activeModule);
  };

  // Sync Spec URL when workspace or service changes
  useEffect(() => {
    updateSpecUrl(activeWorkspaceId, activeServiceId, activeModule);
  }, [activeWorkspaceId, activeServiceId, activeModule, updateSpecUrl]);

  // Handle browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      const urlParams = new URLSearchParams(window.location.search);
      const ws = urlParams.get('ws');
      const svc = urlParams.get('svc');
      const mod = urlParams.get('module') || urlParams.get('tag');

      if (ws) setActiveWorkspaceId(ws);
      if (svc) setActiveServiceId(svc);
      if (mod) setActiveModule(mod);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global Spotlight Search shortcut (Cmd+K / Ctrl+K or '/')
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleNavigate = (path: string) => {
    try {
      const dummy = new URL(path, window.location.origin);
      const targetPath = dummy.pathname;
      const targetModule = dummy.searchParams.get('module') || dummy.searchParams.get('tag');

      if (window.location.pathname !== targetPath || (targetModule && targetModule !== activeModule)) {
        dummy.searchParams.set('ws', activeWorkspaceId);
        dummy.searchParams.set('svc', activeServiceId);
        window.history.pushState(null, '', dummy.pathname + dummy.search);
        setCurrentPath(targetPath);

        if (targetModule) {
          setActiveModule(targetModule);
        } else if (targetPath.startsWith('/docs')) {
          setActiveModule('all');
        }
      }
    } catch (e) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
    }
  };

  // Fetch nav config from backend
  useEffect(() => {
    fetch('/docs/nav')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load nav config');
        return res.json();
      })
      .then((data: NavConfig) => {
        if (data && data.title) {
          setNavConfig(data);
          document.title = data.title;
        }
      })
      .catch(() => {});
  }, []);

  // Fetch swagger.json to extract available modules/tags and all endpoint keys
  useEffect(() => {
    fetch(specUrl)
      .then((res) => res.json())
      .then((swagger: any) => {
        if (swagger) {
          const tagsSet = new Set<string>();
          const endpoints: string[] = [];

          if (swagger.tags && Array.isArray(swagger.tags)) {
            swagger.tags.forEach((t: any) => {
              if (t && t.name) tagsSet.add(t.name);
            });
          }

          if (swagger.paths && typeof swagger.paths === 'object') {
            for (const path in swagger.paths) {
              const methods = swagger.paths[path];
              for (const method in methods) {
                if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
                  endpoints.push(`${method.toUpperCase()} ${path}`);
                  const op = methods[method];
                  if (op && op.tags && Array.isArray(op.tags)) {
                    op.tags.forEach((t: string) => tagsSet.add(t));
                  }
                }
              }
            }
          }

          setAvailableModules(Array.from(tagsSet));
          setAllEndpointsList(endpoints);
        }
      })
      .catch(() => {});
  }, [specUrl]);

  // Fetch persisted QA test records from server
  useEffect(() => {
    fetch(`/docs/qa/data?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setQAData(data);
        }
      })
      .catch(() => {});
  }, [activeWorkspaceId, activeServiceId]);

  // Module filter handler
  const handleModuleChange = (mod: string) => {
    setActiveModule(mod);
    updateSpecUrl(activeWorkspaceId, activeServiceId, mod);
  };

  // Calculate QA stats
  const calculateStats = (): QAStats => {
    let passed = 0;
    let retest = 0;
    let failed = 0;

    for (const key in qaData) {
      const item = qaData[key];
      if (item?.status === 'passed') passed++;
      else if (item?.status === 'retest') retest++;
      else if (item?.status === 'failed') failed++;
    }

    const tested = passed + retest + failed;
    const total = Math.max(allEndpointsList.length, Object.keys(qaData).length, tested);
    const untested = Math.max(0, total - tested);

    return {
      passed,
      retest,
      failed,
      untested,
      total,
    };
  };

  const handleResetQA = async () => {
    try {
      await fetch(`/docs/qa/reset?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`, {
        method: 'POST',
      });
      setQAData({});
      setIsReportOpen(false);
    } catch (e) {}
  };

  const handleSaveInspectRecord = async (
    endpoint: string,
    status: 'passed' | 'retest' | 'failed' | 'untested',
    comment: string
  ) => {
    const timeStr = new Date().toLocaleString();
    const updated = {
      ...qaData,
      [endpoint]: {
        status,
        comment,
        tested_at: timeStr,
      },
    };
    setQAData(updated);

    try {
      await fetch(`/docs/qa/record?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          endpoint_key: endpoint,
          status,
          comment,
        }),
      });
    } catch (e) {}
  };

  // Route: Login View
  if (currentPath === '/docs/login' || currentPath === '/login') {
    return <LoginView config={navConfig} />;
  }

  const isSandbox = currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger';
  const isGuide = currentPath.startsWith('/guide');
  const isDashboard = currentPath === '/dashboard' || currentPath === '/health';
  const isHome = currentPath === '/' || currentPath === '' || currentPath === '/landing';

  const hasCredentials = !!(
    credentials.accessToken ||
    credentials.tenantId ||
    credentials.entityId ||
    (credentials.customHeaders && Object.keys(credentials.customHeaders).length > 0)
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar with Workspace Switcher & Audit Button */}
      <Navbar
        config={navConfig}
        currentPath={currentPath}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeServiceId={activeServiceId}
        writesEnabled={capabilities.workspace_writes_enabled}
        securityAuditEnabled={capabilities.security_audit_enabled}
        onSelectService={handleSelectService}
        onOpenImporter={() => setIsImporterModalOpen(true)}
        onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenCredentials={() => setIsCredsModalOpen(true)}
        hasCredentials={hasCredentials}
      />

      {/* Render route views */}
      {isGuide && <GuideView specUrl={specUrl} title={navConfig.title} credentials={credentials} />}
      {isHome && (
        <LandingView
          config={navConfig}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeServiceId={activeServiceId}
          writesEnabled={capabilities.workspace_writes_enabled}
          securityAuditEnabled={capabilities.security_audit_enabled}
          onSelectService={handleSelectService}
          onOpenImporter={() => setIsImporterModalOpen(true)}
          onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
          onNavigate={handleNavigate}
        />
      )}
      {isDashboard && <HealthView />}
      {isSandbox && (
        <SwaggerSandboxView
          specUrl={specUrl}
          activeModule={activeModule}
          onModuleChange={handleModuleChange}
          availableModules={availableModules}
          qaMode={qaMode}
          onToggleQAMode={() => setQAMode(!qaMode)}
          onOpenQAReport={() => setIsReportOpen(true)}
          onInspectEndpoint={(ep) => setInspectEndpoint(ep)}
          qaStats={calculateStats()}
          qaData={qaData}
          onUpdateQAData={setQAData}
          credentials={credentials}
          onUpdateCredentials={handleUpdateCredentials}
          onOpenCredentials={() => setIsCredsModalOpen(true)}
        />
      )}
      {!isGuide && !isHome && !isDashboard && !isSandbox && (
        <SwaggerSandboxView
          specUrl={specUrl}
          activeModule={activeModule}
          onModuleChange={handleModuleChange}
          availableModules={availableModules}
          qaMode={qaMode}
          onToggleQAMode={() => setQAMode(!qaMode)}
          onOpenQAReport={() => setIsReportOpen(true)}
          onInspectEndpoint={(ep) => setInspectEndpoint(ep)}
          qaStats={calculateStats()}
          qaData={qaData}
          onUpdateQAData={setQAData}
          credentials={credentials}
          onUpdateCredentials={handleUpdateCredentials}
          onOpenCredentials={() => setIsCredsModalOpen(true)}
        />
      )}

      {/* Unified Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>
          &copy; {new Date().getFullYear()} {navConfig.title} &bull; Powered by{' '}
          <a
            href="https://github.com/Natykufsky/go-apidocs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline font-semibold"
          >
            go-apidocs
          </a>{' '}
          &bull; Eng. Kufre N. Moses
        </p>
      </footer>

      {/* Mac Glassmorphic Spotlight Search Modal */}
      <SpotlightSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        allEndpoints={allEndpointsList}
        qaData={qaData}
        availableModules={availableModules}
        navItems={navConfig.nav_items}
        onNavigate={handleNavigate}
        onSelectModule={handleModuleChange}
        onInspectEndpoint={(ep) => setInspectEndpoint(ep)}
      />

      {/* Credentials & Multi-Tenant Tokens Modal */}
      <CredentialManagerModal
        isOpen={isCredsModalOpen}
        onClose={() => setIsCredsModalOpen(false)}
        credentials={credentials}
        onSave={handleUpdateCredentials}
        onClear={handleClearCredentials}
      />

      {/* Code Snippet Generator Modal */}
      <CodeSnippetModal
        isOpen={!!snippetEndpoint}
        onClose={() => setSnippetEndpoint(null)}
        endpointKey={snippetEndpoint || ''}
        credentials={credentials}
      />

      {/* Pre-Flight Schema Importer Modal */}
      {isImporterModalOpen && (
        <SchemaImporterModal
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          maxSpecBytes={capabilities.max_spec_bytes}
          remoteFetchEnabled={capabilities.remote_fetch_enabled}
          onClose={() => setIsImporterModalOpen(false)}
          onImportSuccess={(wsId, svcId) => {
            setIsImporterModalOpen(false);
            refreshWorkspaces();
            handleSelectService(wsId, svcId);
            handleNavigate('/docs');
          }}
        />
      )}

      {/* Cybersecurity & Compliance Audit Modal */}
      {isSecurityModalOpen && (
        <SecurityAuditModal
          activeWorkspaceId={activeWorkspaceId}
          activeServiceId={activeServiceId}
          onClose={() => setIsSecurityModalOpen(false)}
        />
      )}

      {/* QA Report Modal */}
      <QAReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={navConfig.title}
        qaData={qaData}
        allEndpoints={allEndpointsList}
        onReset={handleResetQA}
        onInspectEndpoint={(ep) => {
          setIsReportOpen(false);
          setInspectEndpoint(ep);
        }}
      />

      {/* QA Endpoint Inspector Modal */}
      <QAInspectModal
        isOpen={!!inspectEndpoint}
        onClose={() => setInspectEndpoint(null)}
        endpointKey={inspectEndpoint || ''}
        endpointsList={allEndpointsList.length > 0 ? allEndpointsList : Object.keys(qaData)}
        qaData={qaData}
        onSaveRecord={handleSaveInspectRecord}
        onSelectEndpoint={(ep) => setInspectEndpoint(ep)}
        onOpenSnippetGenerator={(ep) => setSnippetEndpoint(ep)}
      />
    </div>
  );
};
