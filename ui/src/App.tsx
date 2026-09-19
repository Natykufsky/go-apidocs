import React, { useEffect, useState } from 'react';
import { Navbar, NavConfig } from './components/Navbar';
import { QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';
import { QAInspectModal } from './components/QAInspectModal';
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
  const [inspectEndpoint, setInspectEndpoint] = useState<string | null>(null);
  const [specUrl, setSpecUrl] = useState<string>('/docs/swagger.json');

  // Handle initial search params (?module=... or ?tag=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mod = urlParams.get('module') || urlParams.get('tag');
    if (mod) {
      setActiveModule(mod);
      setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
    }
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

  const handleNavigate = (path: string) => {
    try {
      const dummy = new URL(path, window.location.origin);
      const targetPath = dummy.pathname;
      const targetModule = dummy.searchParams.get('module') || dummy.searchParams.get('tag');

      if (targetModule) {
        setActiveModule(targetModule);
        setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(targetModule)}`);
      } else if (targetPath.startsWith('/docs') && !dummy.search) {
        setActiveModule('all');
        setSpecUrl('/docs/swagger.json');
      }

      window.history.pushState(null, '', path);
      setCurrentPath(targetPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
    }
  };

  // Load Nav Config from /docs/nav
  useEffect(() => {
    fetch('/docs/nav')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setNavConfig((prev) => ({
            ...prev,
            title: data.title || prev.title,
            subtitle: data.subtitle || prev.subtitle,
            icon: data.icon || prev.icon,
            nav_items: data.nav_items?.length ? data.nav_items : prev.nav_items,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch OpenAPI tags to populate Scope filter dropdown
  useEffect(() => {
    fetch('/docs/swagger.json')
      .then((res) => res.json())
      .then((spec) => {
        if (spec && Array.isArray(spec.tags) && spec.tags.length > 0) {
          const tags = spec.tags
            .map((t: any) => (typeof t === 'string' ? t : t.name))
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          if (tags.length > 0) {
            setAvailableModules(tags);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load QA Data from /docs/qa/data
  const loadQAData = async () => {
    try {
      const res = await fetch('/docs/qa/data');
      if (res.ok) {
        const data = await res.json();
        setQAData(data || {});
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadQAData();
  }, []);

  // Update spec URL based on active module / scope
  const handleModuleChange = (mod: string) => {
    setActiveModule(mod);
    if (mod === 'all') {
      setSpecUrl('/docs/swagger.json');
      if (currentPath.startsWith('/docs')) {
        window.history.replaceState(null, '', '/docs');
      }
    } else {
      setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
      if (currentPath.startsWith('/docs')) {
        window.history.replaceState(null, '', `/docs?module=${encodeURIComponent(mod)}`);
      }
    }
  };

  // Calculate QA stats
  const calculateStats = (): QAStats => {
    let passed = 0;
    let retest = 0;
    let failed = 0;
    let total = Object.keys(qaData).length;

    for (const key in qaData) {
      const item = qaData[key];
      if (item.status === 'passed') passed++;
      else if (item.status === 'retest') retest++;
      else if (item.status === 'failed') failed++;
    }

    return {
      passed,
      retest,
      failed,
      untested: Math.max(0, total - (passed + retest + failed)),
      total: Math.max(total, passed + retest + failed),
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Single, consistent, mobile-first unified header across all routes */}
      <Navbar
        config={navConfig}
        currentPath={currentPath}
        onNavigate={handleNavigate}
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

      {/* QA Report Modal */}
      <QAReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={navConfig.title}
        qaData={qaData}
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
        endpointsList={Object.keys(qaData)}
        qaData={qaData}
        onSaveRecord={handleSaveInspectRecord}
        onSelectEndpoint={(ep) => setInspectEndpoint(ep)}
      />
    </div>
  );
};
