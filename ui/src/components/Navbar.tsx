import React, { useState } from 'react';
import { Menu, Lock, Search, KeyRound, ShieldCheck, ChevronRight, Layers } from 'lucide-react';
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

  const getPageTitle = () => {
    if (currentPath === '/' || currentPath === '' || currentPath === '/landing') return 'Overview';
    if (currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger') return 'API Sandbox';
    if (currentPath.startsWith('/guide')) return 'Interactive Guide';
    if (currentPath === '/dashboard' || currentPath === '/health') return 'System Health';
    return 'Explorer';
  };

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSvc = activeWs?.services?.find((s) => s.id === activeServiceId) || activeWs?.services?.[0];

  return (
    <header className="sticky top-0 z-20 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Mobile Toggle & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb Hierarchy */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium truncate">
            <span className="text-slate-400 hidden sm:inline">{activeWs?.name || 'Workspace'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <span className="text-slate-700 font-semibold truncate flex items-center gap-1">
              <span>{activeSvc?.icon || '⚡'}</span>
              <span>{activeSvc?.title || 'Main API'}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {getPageTitle()}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Spotlight Search Trigger */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              title="Spotlight Search (Cmd+K / Ctrl+K)"
              className="hidden sm:flex items-center gap-2 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold hidden md:inline">Search...</span>
              <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500 shadow-2xs">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Security Audit Quick Button */}
          {securityAuditEnabled && onOpenSecurityAudit && (
            <button
              onClick={onOpenSecurityAudit}
              title="Run Cybersecurity & Compliance Audit"
              className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Security</span>
            </button>
          )}

          {/* Tokens / Auth Credentials Manager trigger */}
          {onOpenCredentials && (
            <button
              onClick={onOpenCredentials}
              title="Manage API Tokens & Tenant Headers"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                hasCredentials
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200/80 text-slate-600'
              }`}
            >
              <KeyRound className={`w-3.5 h-3.5 ${hasCredentials ? 'text-amber-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{hasCredentials ? 'Auth 🔐' : 'Auth'}</span>
            </button>
          )}

          {/* Font Size Selector */}
          <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 rounded-xl px-2 py-1 text-xs">
            <span className="text-slate-500 font-bold select-none text-[11px]">Aa</span>
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              title="Adjust Portal Font Size"
              className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="90%">90%</option>
              <option value="100%">100%</option>
              <option value="110%">110%</option>
              <option value="125%">125%</option>
            </select>
          </div>

          {/* Session Lock / Logout */}
          <a
            href="/docs/logout"
            title="Lock Session"
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-all text-xs flex items-center ml-0.5"
          >
            <Lock className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
};

