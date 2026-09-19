import React, { useEffect, useState } from 'react';
import { Navbar, NavConfig } from './components/Navbar';
import { QABar, QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';
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
  const [specUrl, setSpecUrl] = useState<string>('/docs/swagger.json');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Fetch OpenAPI tags to populate Scope dropdown dynamically
  useEffect(() => {
    fetch('/docs/swagger.json')
      .then((res) => res.json())
      .then((spec) => {
        if (spec && Array.isArray(spec.tags) && spec.tags.length > 0) {
          const tags = spec.tags
            .map((t: any) => (typeof t === 'string' ? t : t.name))
            .filter(Boolean);
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

  // Update URL spec based on module / tag
  const handleModuleChange = (mod: string) => {
    setActiveModule(mod);
    if (mod === 'all') {
      setSpecUrl('/docs/swagger.json');
    } else {
      setSpecUrl(`/docs/swagger.json?module=${encodeURIComponent(mod)}`);
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

  // Route 1: Login View
  if (currentPath === '/docs/login' || currentPath === '/login') {
    return <LoginView config={navConfig} />;
  }

  const isSandbox = currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger';
  const isGuide = currentPath.startsWith('/guide');
  const isDashboard = currentPath === '/dashboard' || currentPath === '/health';
  const isHome = currentPath === '/' || currentPath === '' || currentPath === '/landing';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        config={navConfig}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        availableModules={availableModules}
        qaMode={qaMode}
        onToggleQAMode={() => setQAMode(!qaMode)}
        onOpenQAReport={() => setIsReportOpen(true)}
      />

      {isSandbox && qaMode && <QABar stats={calculateStats()} />}

      {/* Render matching view */}
      {isGuide && <GuideView specUrl={specUrl} title={navConfig.title} />}
      {isHome && <LandingView config={navConfig} onNavigate={handleNavigate} />}
      {isDashboard && <HealthView />}
      {isSandbox && <SwaggerSandboxView specUrl={specUrl} />}
      {!isGuide && !isHome && !isDashboard && !isSandbox && (
        <SwaggerSandboxView specUrl={specUrl} />
      )}

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

      <QAReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={navConfig.title}
        qaData={qaData}
        onReset={handleResetQA}
      />
    </div>
  );
};
