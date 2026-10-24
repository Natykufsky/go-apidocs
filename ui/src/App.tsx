import React, { useEffect, useState, useCallback } from 'react';
import { Navbar, NavConfig } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';
import { QAInspectModal } from './components/QAInspectModal';
import { SpotlightSearchModal } from './components/SpotlightSearchModal';
import { CredentialManagerModal } from './components/CredentialManagerModal';
import { CodeSnippetModal } from './components/CodeSnippetModal';
import { SchemaImporterModal } from './components/SchemaImporterModal';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { AITestGeneratorModal, AITestCase } from './components/AITestGeneratorModal';
import { TenantSettingsModal, TenantTheme } from './components/TenantSettingsModal';
import { SDKGeneratorModal } from './components/SDKGeneratorModal';
import { Workspace } from './components/WorkspaceSwitcher';
import { WorkspaceManagerModal } from './components/WorkspaceManagerModal';
import { WorkspaceUnlockModal } from './components/WorkspaceUnlockModal';
import { WorkspaceInviteModal } from './components/WorkspaceInviteModal';
import { LiveSpecEditorModal } from './components/LiveSpecEditorModal';
import { LoginView } from './components/LoginView';
import { GuideView } from './components/GuideView';
import { LandingView } from './components/LandingView';
import { HealthView } from './components/HealthView';
import { SwaggerSandboxView } from './components/SwaggerSandboxView';
import { NotFoundView } from './components/NotFoundView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { QAProvider, useQA } from './context/QAContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './components/Toast';

export interface Capabilities {
  workspaces_enabled: boolean;
  workspace_writes_enabled: boolean;
  security_audit_enabled: boolean;
  live_spec_editing_enabled: boolean;
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

  const { credentials, hasCredentials, updateCredentials, clearCredentials, maskPII, toggleMaskPII, activeEnv, setActiveEnv } = useAuth();
  const {
    capabilities,
    workspaces,
    activeWorkspaceId,
    activeServiceId,
    activeModule,
    specUrl,
    setActiveModule,
    selectService,
    refreshWorkspaces,
  } = useWorkspace();
  const { qaData, stats: qaStats, endpoints: allEndpointsList, modules: availableModules, saveRecord, resetQA, setQAData } = useQA();
  const toast = useToast();

  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState<boolean>(false);
  const [isImporterModalOpen, setIsImporterModalOpen] = useState<boolean>(false);
  const [isWorkspaceManagerOpen, setIsWorkspaceManagerOpen] = useState<boolean>(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [unlockTargetWs, setUnlockTargetWs] = useState<{ id: string; name: string } | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteTargetWs, setInviteTargetWs] = useState<{ id: string; name: string } | null>(null);
  const [isLiveSpecEditorOpen, setIsLiveSpecEditorOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState<boolean>(false);
  const [isSDKModalOpen, setIsSDKModalOpen] = useState<boolean>(false);
  const [tenantTheme, setTenantTheme] = useState<TenantTheme | null>(null);
  const [inspectEndpoint, setInspectEndpoint] = useState<string | null>(null);
  const [snippetEndpoint, setSnippetEndpoint] = useState<string | null>(null);
  const [aiTestEndpoint, setAiTestEndpoint] = useState<string | null>(null);
  const [qaMode, setQAMode] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('apidocs_sidebar_collapsed') === 'true';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const applyTheme = (theme: TenantTheme) => {
    setTenantTheme(theme);
    if (theme.primary_color) {
      document.documentElement.style.setProperty('--color-primary', theme.primary_color);
    }
    if (theme.accent_color) {
      document.documentElement.style.setProperty('--color-accent', theme.accent_color);
    }
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('apidocs_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Fetch nav config from backend (optional endpoint; silently falls back)
  // Handle browser popstate — re-sync path and query-derived state
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      const urlParams = new URLSearchParams(window.location.search);
      const ws = urlParams.get('ws');
      const svc = urlParams.get('svc');
      const mod = urlParams.get('module') || urlParams.get('tag');

      if (ws && svc) selectService(ws, svc);
      if (mod) setActiveModule(mod);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectService, setActiveModule]);

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

  // Handle Workspace & Service Selection (with server-authoritative lock check)
  const handleSelectService = (wsId: string, svcId: string) => {
    const targetWs = workspaces.find((w) => w.id === wsId);
    if (targetWs && targetWs.is_locked && targetWs.is_unlocked === false) {
      setUnlockTargetWs({ id: wsId, name: targetWs.name });
      setIsUnlockModalOpen(true);
      return;
    }
    selectService(wsId, svcId);
  };

  const handleModuleChange = (mod: string) => {
    setActiveModule(mod);
  };

  const handleResetQA = async () => {
    try {
      await resetQA();
      setIsReportOpen(false);
      toast.success('QA records reset');
    } catch {
      toast.error('Failed to reset QA records');
    }
  };

  const handleSaveInspectRecord = (endpoint: string, status: 'passed' | 'retest' | 'failed' | 'untested', comment: string) => {
    saveRecord(endpoint, status, comment);
    toast.success(`${endpoint} marked as ${status}`);
  };

  // Route: Login & Registration View
  if (currentPath === '/docs/login' || currentPath === '/login') {
    return <LoginView config={navConfig} initialMode="login" onNavigate={handleNavigate} />;
  }
  if (currentPath === '/register' || currentPath === '/docs/register') {
    return <LoginView config={navConfig} initialMode="register" onNavigate={handleNavigate} />;
  }

  const isSandbox = currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger';
  const isGuide = currentPath.startsWith('/guide');
  const isDashboard = currentPath === '/dashboard' || currentPath === '/health';
  const isHome = currentPath === '/' || currentPath === '' || currentPath === '/landing';
  const isKnownRoute = isSandbox || isGuide || isDashboard || isHome;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      {/* Collapsible Left Sidebar Navigation Hub (Visible in App views: /docs, /guide, /dashboard) */}
      {!isHome && (
        <Sidebar
          config={navConfig}
          currentPath={currentPath}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeServiceId={activeServiceId}
          writesEnabled={capabilities.workspace_writes_enabled}
          securityAuditEnabled={capabilities.security_audit_enabled}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onSelectService={handleSelectService}
          onOpenImporter={() => setIsImporterModalOpen(true)}
          onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
          onOpenAITests={() => setAiTestEndpoint(allEndpointsList[0] || 'POST /api/v1/auth')}
          onNavigate={handleNavigate}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          onOpenCredentials={() => setIsCredsModalOpen(true)}
          onOpenQAReport={() => setIsReportOpen(true)}
          hasCredentials={hasCredentials}
          activeModule={activeModule}
          availableModules={availableModules}
          onSelectModule={handleModuleChange}
          activeEnv={activeEnv}
          onSelectEnv={(env) => setActiveEnv(env)}
          maskPII={maskPII}
          onToggleMaskPII={toggleMaskPII}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Sleek Minimal Top Navbar with Top-Level Workspace Switcher (Rendered in App views) */}
        {!isHome && (
          <Navbar
            config={navConfig}
            currentPath={currentPath}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            activeServiceId={activeServiceId}
            writesEnabled={capabilities.workspace_writes_enabled}
            securityAuditEnabled={capabilities.security_audit_enabled}
            liveSpecEditingEnabled={capabilities.live_spec_editing_enabled}
            onSelectService={handleSelectService}
            onOpenImporter={() => setIsImporterModalOpen(true)}
            onOpenWorkspaceManager={() => setIsWorkspaceManagerOpen(true)}
            onOpenSecurityAudit={() => setIsSecurityModalOpen(true)}
            onOpenLiveSpec={() => setIsLiveSpecEditorOpen(true)}
            onOpenAITests={() => setAiTestEndpoint(allEndpointsList[0] || 'POST /api/v1/auth')}
            onOpenSDKGenerator={() => setIsSDKModalOpen(true)}
            onOpenTenantSettings={() => setIsTenantModalOpen(true)}
            onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            onOpenSearch={() => setIsSearchModalOpen(true)}
            onOpenCredentials={() => setIsCredsModalOpen(true)}
            onOpenQAReport={() => setIsReportOpen(true)}
            hasCredentials={hasCredentials}
            activeEnv={activeEnv}
            maskPII={maskPII}
          />
        )}

        {/* View Router */}
        <div className="flex-1 flex flex-col">
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
              qaStats={qaStats}
              qaData={qaData}
              onUpdateQAData={setQAData}
              credentials={credentials}
              onUpdateCredentials={updateCredentials}
              onOpenCredentials={() => setIsCredsModalOpen(true)}
              maskPII={maskPII}
            />
          )}
          {!isKnownRoute && <NotFoundView onNavigateHome={() => handleNavigate('/')} />}
        </div>

        {/* Unified Footer */}
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white mt-auto">
          <p>
            &copy; {new Date().getFullYear()} {navConfig.title} &bull; Powered by{' '}
            <a
              href="https://github.com/Natykufsky/go-apidocs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline font-semibold"
            >
              go-apidocs
            </a>{' '}
            &bull; Eng. Kufre N. Moses
          </p>
        </footer>
      </div>

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
        onSave={updateCredentials}
        onClear={clearCredentials}
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
        onOpenAIGenerator={(ep) => setAiTestEndpoint(ep)}
      />

      {/* AI DeepSeek Test Suite Generator Modal */}
      <AITestGeneratorModal
        isOpen={!!aiTestEndpoint}
        onClose={() => setAiTestEndpoint(null)}
        endpointKey={aiTestEndpoint || ''}
        endpointsList={allEndpointsList.length > 0 ? allEndpointsList : Object.keys(qaData)}
        onLoadIntoSandbox={(tc) => {
          // If body exists, store temporary sandbox preload payload
          if (tc.request_body) {
            try {
              sessionStorage.setItem('apidocs_sandbox_preload', JSON.stringify(tc.request_body));
            } catch (e) {}
          }
          handleNavigate('/docs');
        }}
      />

      {/* SaaS Tenant Settings & Theme Customizer Modal */}
      <TenantSettingsModal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        onThemeSaved={applyTheme}
      />

      {/* Client SDK Generator Modal */}
      <SDKGeneratorModal
        isOpen={isSDKModalOpen}
        onClose={() => setIsSDKModalOpen(false)}
      />

      {/* Workspace CRUD Management Modal */}
      <WorkspaceManagerModal
        isOpen={isWorkspaceManagerOpen}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onClose={() => setIsWorkspaceManagerOpen(false)}
        onRefreshWorkspaces={refreshWorkspaces}
        onOpenInvite={(wsId, wsName) => {
          setInviteTargetWs({ id: wsId, name: wsName });
          setIsInviteModalOpen(true);
        }}
      />

      {/* Workspace Unlock Modal */}
      <WorkspaceUnlockModal
        isOpen={isUnlockModalOpen}
        workspaceId={unlockTargetWs?.id || ''}
        workspaceName={unlockTargetWs?.name || ''}
        onClose={() => {
          setIsUnlockModalOpen(false);
          setUnlockTargetWs(null);
        }}
        onSuccess={() => {
          const unlockedId = unlockTargetWs?.id;
          setIsUnlockModalOpen(false);
          setUnlockTargetWs(null);
          toast.success('Workspace unlocked');
          refreshWorkspaces().then(() => {
            if (unlockedId) {
              const targetWs = workspaces.find((w) => w.id === unlockedId);
              selectService(unlockedId, targetWs?.services?.[0]?.id || 'default');
            }
          });
        }}
      />

      {/* Workspace Invite Modal */}
      <WorkspaceInviteModal
        isOpen={isInviteModalOpen}
        workspaceId={inviteTargetWs?.id || ''}
        workspaceName={inviteTargetWs?.name || ''}
        onClose={() => {
          setIsInviteModalOpen(false);
          setInviteTargetWs(null);
        }}
      />

      {/* Live OpenAPI Spec Editor Modal */}
      <LiveSpecEditorModal
        isOpen={isLiveSpecEditorOpen}
        workspaceId={activeWorkspaceId}
        serviceId={activeServiceId}
        serviceTitle={workspaces.find((w) => w.id === activeWorkspaceId)?.services?.find((s) => s.id === activeServiceId)?.title || 'Current Service'}
        onClose={() => setIsLiveSpecEditorOpen(false)}
        onSpecSaved={() => {
          toast.success('Spec saved — refreshing sandbox');
          // specUrl derives from ws/svc/module; bump refreshWorkspaces to pull latest meta
          refreshWorkspaces();
        }}
      />
    </div>
  );
};
