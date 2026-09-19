import React, { useEffect, useState, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Navbar, NavConfig } from './components/Navbar';
import { QABar, QAStats } from './components/QABar';
import { QAReportModal, QARecord } from './components/QAReportModal';

export const App: React.FC = () => {
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

  // Calculate stats
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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Navbar
        config={navConfig}
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        availableModules={availableModules}
        qaMode={qaMode}
        onToggleQAMode={() => setQAMode(!qaMode)}
        onOpenQAReport={() => setIsReportOpen(true)}
      />

      {qaMode && <QABar stats={calculateStats()} />}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
          <SwaggerUI
            url={specUrl}
            docExpansion="list"
            filter={true}
            persistAuthorization={true}
            displayRequestDuration={true}
          />
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>
          &copy; {new Date().getFullYear()} {navConfig.title} &bull; Powered by{' '}
          <a
            href="https://github.com/Natykufsky/go-apidocs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-semibold"
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
