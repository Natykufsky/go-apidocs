import React, { useEffect, useState } from 'react';
import { Navbar, NavConfig } from './components/Navbar';
import { QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';
import { QAInspectModal } from './components/QAInspectModal';
import { SpotlightSearchModal } from './components/SpotlightSearchModal';
import { CredentialManagerModal, StoredCredentials } from './components/CredentialManagerModal';
import { CodeSnippetModal } from './components/CodeSnippetModal';
import { LoginView } from './components/LoginView';
import { GuideView } from './components/GuideView';
import { LandingView } from './components/LandingView';
import { HealthView } from './components/HealthView';
import { SwaggerSandboxView } from './components/SwaggerSandboxView';

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

  const [activeModule, setActiveModule] = useState<string>('all');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [qaMode, setQAMode] = useState<boolean>(true);
  const [qaData, setQAData] = useState<Record<string, QARecord>>({});
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState<boolean>(false);
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

  // Handle initial search params (?module=... or ?tag=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mod = urlParams.get('module') || urlParams.get('tag');
    if (mod) {
      setActiveModule(mod);
      setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
    }

    const handleImportEvent = (e: any) => {
      if (e.detail) {
        setSpecUrl(e.detail);
        setActiveModule('imported');
      }
    };
    window.addEventListener('apidocs:import_spec', handleImportEvent);
    return () => window.removeEventListener('apidocs:import_spec', handleImportEvent);
  }, []);

  // Handle browser navigation history (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      const urlParams = new URLSearchParams(window.location.search);
      const mod = urlParams.get('module') || urlParams.get('tag');
      if (mod) {
        setActiveModule(mod);
        setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
      } else if (window.location.pathname.startsWith('/docs')) {
        setActiveModule('all');
        setSpecUrl('/docs/swagger.json');
      }
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
        window.history.pushState(null, '', path);
        setCurrentPath(targetPath);

        if (targetModule) {
          setActiveModule(targetModule);
          setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(targetModule)}`);
        } else if (targetPath.startsWith('/docs')) {
          setActiveModule('all');
          setSpecUrl('/docs/swagger.json');
        }
      }
    } catch (e) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
    }
  };

  // Fetch nav config from backend
  useEffect(() => {
    fetch('/docs/nav.json')
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
    fetch('/docs/swagger.json')
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
  }, []);

  // Fetch persisted QA test records from server
  useEffect(() => {
    fetch('/docs/qa/data')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setQAData(data);
        }
      })
      .catch(() => {});
  }, []);

  // Module filter handler
  const handleModuleChange = (mod: string) => {
    setActiveModule(mod);
    if (mod === 'all') {
      setSpecUrl('/docs/swagger.json');
      if (window.location.pathname.startsWith('/docs')) {
        window.history.replaceState(null, '', '/docs');
      }
    } else if (mod === 'imported') {
      // Keep specUrl untouched
    } else {
      setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
      if (window.location.pathname.startsWith('/docs')) {
        window.history.replaceState(null, '', `/docs?module=${encodeURIComponent(mod)}`);
      }
    }
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
      await fetch('/docs/qa/reset', { method: 'POST' });
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
      await fetch('/docs/qa/record', {
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
      {/* Single, consistent, mobile-first unified header across all routes */}
      <Navbar
        config={navConfig}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        onOpenCredentials={() => setIsCredsModalOpen(true)}
        hasCredentials={hasCredentials}
      />

      {/* Render route views */}
      {isGuide && <GuideView specUrl={specUrl} title={navConfig.title} />}
      {isHome && <LandingView config={navConfig} onNavigate={handleNavigate} />}
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

      {/* Code Snippet Generator Modal (cURL, Go, Node, Python) */}
      <CodeSnippetModal
        isOpen={!!snippetEndpoint}
        onClose={() => setSnippetEndpoint(null)}
        endpointKey={snippetEndpoint || ''}
        credentials={credentials}
      />

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
