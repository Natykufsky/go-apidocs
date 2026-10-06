import React, { useState } from 'react';
import { Menu, Lock, Search, ShieldCheck, ChevronRight, Sparkles, KeyRound, EyeOff, Globe } from 'lucide-react';
import { Workspace } from './WorkspaceSwitcher';

export interface NavItem {
  label: string;
  url: string;
  icon?: string;
  badge?: string;
  is_button?: boolean;
  external?: boolean;
}

export interface NavConfig {
  title: string;
  subtitle?: string;
  icon?: string;
  nav_items: NavItem[];
}

interface NavbarProps {
  config: NavConfig;
  currentPath: string;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  activeServiceId?: string;
  securityAuditEnabled?: boolean;
  onOpenSecurityAudit?: () => void;
  onToggleMobileSidebar: () => void;
  onOpenSearch?: () => void;
  onOpenCredentials?: () => void;
  hasCredentials?: boolean;
  activeEnv?: string;
  maskPII?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  currentPath,
  workspaces = [],
  activeWorkspaceId = 'default',
  activeServiceId = 'default',
  securityAuditEnabled = false,
  onOpenSecurityAudit,
  onToggleMobileSidebar,
  onOpenSearch,
  onOpenCredentials,
  hasCredentials = false,
  activeEnv = 'default',
  maskPII = false,
}) => {
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('apidocs_font_size') || '100%';
  });

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    document.documentElement.style.fontSize = size;
    try {
      localStorage.setItem('apidocs_font_size', size);
    } catch (e) {}
  };

  const getPageMeta = () => {
    if (currentPath === '/' || currentPath === '' || currentPath === '/landing') {
      return { title: 'Overview', icon: '🏠', badge: 'Hub' };
    }
    if (currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger') {
      return { title: 'API Sandbox', icon: '⚡', badge: 'Live Test' };
    }
    if (currentPath.startsWith('/guide')) {
      return { title: 'Interactive Guide', icon: '📖', badge: 'Reference' };
    }
    if (currentPath === '/dashboard' || currentPath === '/health') {
      return { title: 'System Health', icon: '📊', badge: 'Telemetry' };
    }
    return { title: 'API Explorer', icon: '📄', badge: 'Spec' };
  };

  const pageMeta = getPageMeta();
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSvc = activeWs?.services?.find((s) => s.id === activeServiceId) || activeWs?.services?.[0];

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Hierarchy Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb Hierarchy */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline truncate max-w-[120px]">
              {activeWs?.name || 'Workspace'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0 hidden sm:inline" />
            <span className="text-slate-800 dark:text-slate-200 font-semibold truncate flex items-center gap-1 max-w-[140px] sm:max-w-[200px]">
              <span className="shrink-0">{activeSvc?.icon || '⚡'}</span>
              <span className="truncate">{activeSvc?.title || 'Main API'}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
            <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-50/90 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs shrink-0">
              <span>{pageMeta.icon}</span>
              <span>{pageMeta.title}</span>
            </span>
          </nav>
        </div>

        {/* Right: Bank-Grade Quick Action Controls & Telemetry */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Environment Indicator */}
          {activeEnv && activeEnv !== 'default' && (
            <div
              title={`Active Environment: ${activeEnv}`}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold text-slate-700 dark:text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="uppercase">{activeEnv}</span>
            </div>
          )}

          {/* Mask PII Indicator */}
          {maskPII && (
            <div
              title="Real-time PII & Secrets Masking Active"
              className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300"
            >
              <EyeOff className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Masked</span>
            </div>
          )}

          {/* Spotlight Search Trigger */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              title="Spotlight Search (Cmd+K / Ctrl+K)"
              className="flex items-center gap-2 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="font-semibold hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Security Audit Quick Launcher */}
          {securityAuditEnabled && onOpenSecurityAudit && (
            <button
              onClick={onOpenSecurityAudit}
              title="Run Cybersecurity & Compliance Audit"
              className="hidden sm:flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Audit</span>
            </button>
          )}

          {/* Quick Credential Status (Compact Pill) */}
          {onOpenCredentials && (
            <button
              onClick={onOpenCredentials}
              title="Sandbox Authentication & Header Mapper"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                hasCredentials
                  ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                  : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
              }`}
            >
              <KeyRound className={`w-3.5 h-3.5 ${hasCredentials ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{hasCredentials ? 'Auth Ready' : 'No Auth'}</span>
            </button>
          )}

          {/* Font Scaling Control */}
          <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-2 py-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold select-none text-[11px]">Aa</span>
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              title="Adjust Portal Typography Scale"
              className="bg-transparent text-slate-700 dark:text-slate-300 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="90%" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">90%</option>
              <option value="100%" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">100%</option>
              <option value="110%" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">110%</option>
              <option value="125%" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">125%</option>
            </select>
          </div>

          {/* Session Lock / Logout */}
          <a
            href="/docs/logout"
            title="Lock Session / Logout"
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-xs flex items-center"
          >
            <Lock className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
};


