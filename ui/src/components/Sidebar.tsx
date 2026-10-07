import React, { useState, useEffect } from 'react';
import {
  Home,
  BookOpen,
  Zap,
  Activity,
  FileCode,
  ShieldCheck,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Lock,
  Search,
  KeyRound,
  FlaskConical,
  Sun,
  Moon,
  Globe,
  Download,
  Filter,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle2,
  X,
  Compass,
} from 'lucide-react';
import { NavItem, NavConfig } from './Navbar';
import { Workspace } from './WorkspaceSwitcher';

interface SidebarProps {
  config: NavConfig;
  currentPath: string;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  activeServiceId?: string;
  writesEnabled?: boolean;
  securityAuditEnabled?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectService?: (workspaceId: string, serviceId: string) => void;
  onOpenImporter?: () => void;
  onOpenSecurityAudit?: () => void;
  onOpenAITests?: () => void;
  onNavigate: (path: string) => void;
  onOpenSearch?: () => void;
  onOpenCredentials?: () => void;
  hasCredentials?: boolean;
  activeModule?: string;
  availableModules?: string[];
  onSelectModule?: (mod: string) => void;
  activeEnv?: string;
  onSelectEnv?: (env: string) => void;
  maskPII?: boolean;
  onToggleMaskPII?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  config,
  currentPath,
  workspaces = [],
  activeWorkspaceId = 'default',
  activeServiceId = 'default',
  writesEnabled = false,
  securityAuditEnabled = false,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onSelectService,
  onOpenImporter,
  onOpenSecurityAudit,
  onOpenAITests,
  onNavigate,
  onOpenSearch,
  onOpenCredentials,
  hasCredentials = false,
  activeModule = 'all',
  availableModules = [],
  onSelectModule,
  activeEnv = 'default',
  onSelectEnv,
  maskPII = false,
  onToggleMaskPII,
}) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('apidocs_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('apidocs_theme', 'dark');
      } catch (e) {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('apidocs_theme', 'light');
      } catch (e) {}
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const isCurrentActive = (url: string) => {
    if (url === '/' && (currentPath === '/' || currentPath === '' || currentPath === '/landing')) return true;
    if (url === '/docs' && (currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger')) return true;
    if (url === '/guide' && currentPath.startsWith('/guide')) return true;
    if (url === '/dashboard' && (currentPath === '/dashboard' || currentPath === '/health')) return true;
    return currentPath === url;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    if (item.external || item.url.endsWith('.json') || item.url.startsWith('http') || item.url.includes('/logout')) {
      return; // Native browser handling
    }
    e.preventDefault();
    onNavigate(item.url);
    onCloseMobile();
  };

  const getNavIcon = (item: NavItem) => {
    if (item.icon) {
      if (item.icon === '🏠') return <Home className="w-4 h-4 shrink-0" />;
      if (item.icon === '📖') return <BookOpen className="w-4 h-4 shrink-0" />;
      if (item.icon === '⚡') return <Zap className="w-4 h-4 shrink-0" />;
      if (item.icon === '📊') return <Activity className="w-4 h-4 shrink-0" />;
      if (item.icon === '📄') return <FileCode className="w-4 h-4 shrink-0" />;
      return <span className="text-base shrink-0">{item.icon}</span>;
    }
    if (item.url === '/') return <Home className="w-4 h-4 shrink-0" />;
    if (item.url.startsWith('/guide')) return <BookOpen className="w-4 h-4 shrink-0" />;
    if (item.url.startsWith('/docs')) return <Zap className="w-4 h-4 shrink-0" />;
    if (item.url.startsWith('/dashboard') || item.url.startsWith('/health')) return <Activity className="w-4 h-4 shrink-0" />;
    return <FileCode className="w-4 h-4 shrink-0" />;
  };

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSvc = activeWs?.services?.find((s) => s.id === activeServiceId) || activeWs?.services?.[0];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between select-none overflow-y-auto">
      {/* Top Header & Branding */}
      <div className="p-3.5 space-y-4">
        {/* Brand & Workspace Hub */}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, { label: 'Home', url: '/' })}
            className="flex items-center gap-2.5 group cursor-pointer shrink-0 min-w-0"
            title={config.title || 'API Documentation'}
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-lg shadow-sm text-white dark:text-slate-950 group-hover:scale-105 transition-transform shrink-0 font-bold">
              {config.icon || '⚡'}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate min-w-0">
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                  {config.title || 'API Cloud Platform'}
                </h1>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none mt-1 truncate">
                  {config.subtitle || 'Developer & QA Suite'}
                </p>
              </div>
            )}
          </a>

          {/* Desktop Collapse Button */}
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 min-h-[36px] min-w-[36px] items-center justify-center"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Drawer Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Close Drawer"
            aria-label="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: OVERVIEW & NAVIGATION */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-2.5 pb-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Overview
            </div>
          )}
          <nav className="space-y-1">
            {config.nav_items?.map((item) => {
              const active = isCurrentActive(item.url);
              return (
                <a
                  key={item.label}
                  href={item.url}
                  onClick={(e) => handleLinkClick(e, item)}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  title={item.label}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                    collapsed ? 'justify-center' : 'justify-between'
                  } ${
                    item.is_button
                      ? 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 shadow-xs font-bold'
                      : active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold border border-slate-200/80 dark:border-slate-700 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getNavIcon(item)}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!collapsed && item.badge && (
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      {item.badge}
                    </span>
                  )}
                  {!collapsed && item.external && <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* SECTION 2: CORE TOOLS */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-2.5 pb-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Core Tools
            </div>
          )}
          <div className="space-y-1">
            {/* AI Test Generation Studio */}
            {onOpenAITests && (
              <button
                type="button"
                onClick={() => {
                  onOpenAITests();
                  onCloseMobile();
                }}
                title="AI DeepSeek Test Suite Synthesis"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200/90 dark:border-purple-800/80 text-purple-900 dark:text-purple-300 hover:from-purple-500/20 hover:to-indigo-500/20 shadow-2xs min-h-[44px] ${
                  collapsed ? 'justify-center' : 'justify-between'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  {!collapsed && <span className="truncate">AI Test Studio</span>}
                </div>
                {!collapsed && (
                  <span className="px-2 py-0.5 text-[9px] rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-extrabold uppercase">
                    DeepSeek
                  </span>
                )}
              </button>
            )}

            {/* Security Audit */}
            {securityAuditEnabled && onOpenSecurityAudit && (
              <button
                type="button"
                onClick={() => {
                  onOpenSecurityAudit();
                  onCloseMobile();
                }}
                title="Run Cybersecurity & Compliance Audit"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                  collapsed
                    ? 'justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                    : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 justify-between'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {!collapsed && <span className="truncate">OWASP Audit</span>}
                </div>
                {!collapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold">
                    Scan
                  </span>
                )}
              </button>
            )}

            {/* Schema Importer */}
            {writesEnabled && onOpenImporter && (
              <button
                type="button"
                onClick={() => {
                  onOpenImporter();
                  onCloseMobile();
                }}
                title="Import OpenAPI / Swagger Spec"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                  collapsed
                    ? 'justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                    : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 justify-start'
                }`}
              >
                <UploadCloud className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                {!collapsed && <span className="truncate">Import OpenAPI Spec</span>}
              </button>
            )}
          </div>
        </div>

        {/* SECTION 3: ENVIRONMENT & FILTER */}
        {(activeSvc?.environments && Object.keys(activeSvc.environments).length > 0) || (availableModules.length > 0 && onSelectModule) ? (
          <div className="space-y-2">
            {!collapsed && (
              <div className="px-2.5 pb-0.5 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Environment & Scope</span>
                <Globe className="w-3 h-3 text-slate-400" />
              </div>
            )}

            {/* Environment Tabs */}
            {activeSvc?.environments && Object.keys(activeSvc.environments).length > 0 && onSelectEnv && (
              <div>
                {!collapsed ? (
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                    {Object.entries(activeSvc.environments).map(([envKey, envUrl]) => (
                      <button
                        key={envKey}
                        type="button"
                        onClick={() => onSelectEnv(envKey)}
                        title={envUrl}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all truncate cursor-pointer min-h-[32px] ${
                          activeEnv === envKey
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {envKey}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex justify-center py-1" title={`Env: ${activeEnv}`}>
                    <Globe className="w-4 h-4 text-emerald-500" />
                  </div>
                )}
              </div>
            )}

            {/* Modules Filter Dropdown/List */}
            {availableModules.length > 0 && onSelectModule && (
              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => onSelectModule('all')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                    collapsed ? 'justify-center' : 'justify-between'
                  } ${
                    activeModule === 'all'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>🌟 {!collapsed && 'All Modules'}</span>
                </button>
                {availableModules.slice(0, 6).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSelectModule(m)}
                    title={`Filter by module: ${m}`}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                      collapsed ? 'justify-center' : 'justify-between'
                    } ${
                      activeModule === m
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate max-w-full text-left" title={m}>
                      📁 {!collapsed && m}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* SECTION 4: DEVELOPER TOOLS */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-2.5 pb-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Developer Tools
            </div>
          )}
          <div className="space-y-1">
            {/* Credentials / Auth Manager */}
            {onOpenCredentials && (
              <button
                type="button"
                onClick={() => {
                  onOpenCredentials();
                  onCloseMobile();
                }}
                title="Manage Tokens & Tenant Headers"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${
                  hasCredentials
                    ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <KeyRound
                    className={`w-4 h-4 shrink-0 ${hasCredentials ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}
                  />
                  {!collapsed && <span className="truncate">Auth & Headers</span>}
                </div>
                {!collapsed && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      hasCredentials
                        ? 'bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                        : 'bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {hasCredentials ? 'Active 🔐' : 'None'}
                  </span>
                )}
              </button>
            )}

            {/* PII Masking Toggle */}
            {onToggleMaskPII && (
              <button
                type="button"
                onClick={onToggleMaskPII}
                title="Toggle Real-time PII & Secrets Masking"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border min-h-[44px] ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${
                  maskPII
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {maskPII ? (
                    <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  {!collapsed && <span className="truncate">Mask PII Data</span>}
                </div>
                {!collapsed && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      maskPII
                        ? 'bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {maskPII ? 'ON' : 'OFF'}
                  </span>
                )}
              </button>
            )}

            {/* Postman Collection Download */}
            <a
              href={`/docs/swagger.json?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`}
              download={`${activeSvc?.title || 'api'}-spec.json`}
              title="Download OpenAPI / Postman Schema"
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] ${
                collapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Download className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                {!collapsed && <span className="truncate">Export JSON Spec</span>}
              </div>
              {!collapsed && <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Footer & Theme Toggle */}
      <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-slate-900/70">
        {!collapsed && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-700 dark:text-slate-300">v2.0 Enterprise</span>
            </span>

            <div className="flex items-center gap-1">
              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              <a
                href="/docs/logout"
                title="Lock Session / Logout"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <Lock className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <a
              href="/docs/logout"
              title="Lock Session"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Lock className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 ease-in-out z-40 sticky top-0 h-screen ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in-20 duration-200">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200 h-full overflow-hidden">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
