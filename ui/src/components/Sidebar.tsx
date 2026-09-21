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
} from 'lucide-react';
import { NavItem, NavConfig } from './Navbar';
import { Workspace, WorkspaceSwitcher } from './WorkspaceSwitcher';

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
      <div className="p-4 space-y-4">
        {/* Brand & Workspace Hub */}
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, { label: 'Home', url: '/' })}
            className="flex items-center gap-2.5 group cursor-pointer shrink-0"
            title={config.title || 'API Documentation'}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/25 text-white group-hover:scale-105 transition-transform shrink-0">
              {config.icon || '⚡'}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none group-hover:text-indigo-600 transition-colors truncate">
                  {config.title || 'API Documentation'}
                </h1>
                <p className="text-[10px] font-semibold text-slate-500 leading-none mt-1 truncate">
                  {config.subtitle || 'Developer & QA Suite'}
                </p>
              </div>
            )}
          </a>

          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Workspace Switcher in Sidebar */}
        {workspaces.length > 0 && onSelectService && (
          <div className="pt-1">
            {!collapsed ? (
              <WorkspaceSwitcher
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                activeServiceId={activeServiceId}
                writesEnabled={writesEnabled}
                onSelectService={onSelectService}
                onOpenImporter={onOpenImporter}
                onOpenSecurityAudit={onOpenSecurityAudit}
              />
            ) : (
              <div className="flex justify-center" title={`${activeWs?.name} - ${activeSvc?.title}`}>
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-700">
                  {activeWs?.icon || '📁'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Spotlight Search Button */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            title="Global Search (⌘K / Ctrl+K)"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              collapsed
                ? 'justify-center bg-slate-100/90 border-slate-200 text-slate-600 hover:bg-slate-200'
                : 'bg-slate-100/80 hover:bg-slate-100 border-slate-200/90 text-slate-600 hover:text-slate-900 justify-between'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              {!collapsed && <span className="truncate">Search API...</span>}
            </div>
            {!collapsed && (
              <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500 shadow-2xs">
                ⌘K
              </kbd>
            )}
          </button>
        )}

        {/* Navigation Items */}
        <div className="pt-2">
          {!collapsed && (
            <div className="px-2 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation
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
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    collapsed ? 'justify-center' : 'justify-between'
                  } ${
                    item.is_button
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-bold'
                      : active
                      ? 'bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200/70 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {getNavIcon(item)}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!collapsed && item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 text-slate-700 font-bold">
                      {item.badge}
                    </span>
                  )}
                  {!collapsed && item.external && <ExternalLink className="w-3 h-3 text-slate-400" />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Live Environments Switcher */}
        {activeSvc?.environments && Object.keys(activeSvc.environments).length > 0 && onSelectEnv && (
          <div className="pt-2">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Environment</span>
                <Globe className="w-3 h-3 text-slate-400" />
              </div>
            )}
            <div className="space-y-1">
              {!collapsed ? (
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                  {Object.entries(activeSvc.environments).map(([envKey, envUrl]) => (
                    <button
                      key={envKey}
                      type="button"
                      onClick={() => onSelectEnv(envKey)}
                      title={envUrl}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold uppercase transition-all truncate cursor-pointer ${
                        activeEnv === envKey
                          ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {envKey}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center" title={`Env: ${activeEnv}`}>
                  <Globe className="w-4 h-4 text-indigo-500" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Active Modules (When on Docs or Guide) */}
        {availableModules.length > 0 && onSelectModule && (
          <div className="pt-2">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Modules ({availableModules.length})</span>
                <Filter className="w-3 h-3 text-slate-400" />
              </div>
            )}
            <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => onSelectModule('all')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${
                  activeModule === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>🌟 {!collapsed && 'All Endpoints'}</span>
              </button>
              {availableModules.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectModule(m)}
                  title={m}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    collapsed ? 'justify-center' : 'justify-between'
                  } ${
                    activeModule === m
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">📁 {!collapsed && m}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tools & Utilities Section */}
        <div className="pt-2">
          {!collapsed && (
            <div className="px-2 pb-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Tools & Security
            </div>
          )}
          <div className="space-y-1">
            {/* Security Audit Launcher */}
            {securityAuditEnabled && onOpenSecurityAudit && (
              <button
                type="button"
                onClick={onOpenSecurityAudit}
                title="Run Cybersecurity & Compliance Audit"
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  collapsed
                    ? 'justify-center bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-slate-200/80 dark:border-slate-700'
                    : 'bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {!collapsed && <span className="truncate">Security Audit</span>}
              </button>
            )}

            {/* Schema Importer Launcher */}
            {writesEnabled && onOpenImporter && (
              <button
                type="button"
                onClick={onOpenImporter}
                title="Import OpenAPI / Swagger Spec"
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  collapsed
                    ? 'justify-center bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-400 border border-slate-200/80 dark:border-slate-700'
                    : 'bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300'
                }`}
              >
                <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {!collapsed && <span className="truncate">Import Schema</span>}
              </button>
            )}

            {/* Postman Collection Download */}
            <a
              href={`/docs/swagger.json?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`}
              download={`${activeSvc?.title || 'api'}-spec.json`}
              title="Download OpenAPI / Postman Schema"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                collapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {!collapsed && <span className="truncate">Export Postman/JSON</span>}
              </div>
              {!collapsed && <ExternalLink className="w-3 h-3 text-slate-400" />}
            </a>

            {/* PII / Secret Masking Toggle */}
            {onToggleMaskPII && (
              <button
                type="button"
                onClick={onToggleMaskPII}
                title="Toggle Real-time PII & Secrets Masking"
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${
                  maskPII
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {maskPII ? (
                    <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  {!collapsed && <span className="truncate">Mask PII & Secrets</span>}
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

            {/* Credentials / Auth Manager */}
            {onOpenCredentials && (
              <button
                type="button"
                onClick={onOpenCredentials}
                title="Manage Tokens & Tenant Headers"
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  collapsed ? 'justify-center' : 'justify-between'
                } ${
                  hasCredentials
                    ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <KeyRound
                    className={`w-4 h-4 shrink-0 ${hasCredentials ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}
                  />
                  {!collapsed && <span className="truncate">Auth & Tokens</span>}
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
          </div>
        </div>
      </div>

      {/* Bottom Footer & Theme Toggle & Collapse */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2 bg-slate-50/60 dark:bg-slate-900/60">
        {!collapsed && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>v1.6.0 Suite</span>
            </span>

            <div className="flex items-center gap-1">
              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              <a
                href="/docs/logout"
                title="Lock Session"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
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
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <a
              href="/docs/logout"
              title="Lock Session"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
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
        className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 ease-in-out z-30 sticky top-0 h-screen ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
