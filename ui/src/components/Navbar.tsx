import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Lock,
  Search,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  KeyRound,
  EyeOff,
  Sliders,
  Settings,
  UploadCloud,
  ChevronDown,
  Layers,
  ExternalLink,
  Zap,
  Code2,
  FileSpreadsheet,
} from 'lucide-react';
import { Workspace, WorkspaceSwitcher } from './WorkspaceSwitcher';

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
  writesEnabled?: boolean;
  securityAuditEnabled?: boolean;
  liveSpecEditingEnabled?: boolean;
  onSelectService?: (workspaceId: string, serviceId: string) => void;
  onOpenImporter?: () => void;
  onOpenWorkspaceManager?: () => void;
  onOpenSecurityAudit?: () => void;
  onOpenLiveSpec?: () => void;
  onOpenAITests?: () => void;
  onOpenSDKGenerator?: () => void;
  onOpenTenantSettings?: () => void;
  onToggleMobileSidebar: () => void;
  onOpenSearch?: () => void;
  onOpenCredentials?: () => void;
  onOpenQAReport?: () => void;
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
  writesEnabled = false,
  securityAuditEnabled = false,
  liveSpecEditingEnabled = false,
  onSelectService,
  onOpenImporter,
  onOpenWorkspaceManager,
  onOpenSecurityAudit,
  onOpenLiveSpec,
  onOpenAITests,
  onOpenSDKGenerator,
  onOpenTenantSettings,
  onToggleMobileSidebar,
  onOpenSearch,
  onOpenCredentials,
  onOpenQAReport,
  hasCredentials = false,
  activeEnv = 'default',
  maskPII = false,
}) => {
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 transition-colors duration-200">
      <div className="w-full px-3 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Left Section: Mobile Drawer Trigger & Workspace Switcher + Breadcrumb */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-all cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95 shadow-2xs border border-slate-200/60 dark:border-slate-700/60"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Workspace Switcher in Navbar */}
          {workspaces.length > 0 && onSelectService && (
            <div className="shrink-0 max-w-[150px] sm:max-w-xs">
              <WorkspaceSwitcher
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                activeServiceId={activeServiceId}
                writesEnabled={writesEnabled}
                onSelectService={onSelectService}
                onOpenImporter={onOpenImporter}
                onOpenManager={onOpenWorkspaceManager}
                onOpenSecurityAudit={onOpenSecurityAudit}
              />
            </div>
          )}

          {/* Breadcrumb Hierarchy */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
            <span className="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-semibold bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700/80 shadow-2xs shrink-0">
              <span>{pageMeta.icon}</span>
              <span>{pageMeta.title}</span>
            </span>
          </nav>
        </div>

        {/* Center Section: Unified Global Command Palette Trigger */}
        {onOpenSearch && (
          <div className="flex-1 max-w-sm lg:max-w-md mx-2 hidden sm:block">
            <button
              onClick={onOpenSearch}
              title="Global Search & Command Palette (⌘K / Ctrl+K)"
              className="w-full flex items-center justify-between bg-slate-100/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs group min-h-[40px]"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
                <span className="font-medium text-slate-600 dark:text-slate-300 truncate">Search API, schemas, endpoints...</span>
              </div>
              <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>
        )}

        {/* Right Section: Compact Status Indicators & Unified Settings Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Mobile Search Button (Compact & Touch friendly) */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              title="Search API (⌘K)"
              className="sm:hidden p-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shadow-2xs border border-slate-200/60 dark:border-slate-700/60"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Active Environment Pill */}
          {activeEnv && activeEnv !== 'default' && (
            <div
              title={`Active Environment: ${activeEnv}`}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="uppercase">{activeEnv}</span>
            </div>
          )}

          {/* Mask PII Indicator */}
          {maskPII && (
            <div
              title="Real-time PII & Secrets Masking Active"
              className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-[11px] font-bold text-purple-700 dark:text-purple-300"
            >
              <EyeOff className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Masked</span>
            </div>
          )}

          {/* Quick Credential Status (Touch-friendly Pill) */}
          {onOpenCredentials && (
            <button
              onClick={onOpenCredentials}
              title="Sandbox Authentication & Header Mapper"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs min-h-[42px] ${
                hasCredentials
                  ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-300 hover:bg-amber-100'
                  : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <KeyRound className={`w-3.5 h-3.5 ${hasCredentials ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{hasCredentials ? 'Auth Configured' : 'Auth'}</span>
            </button>
          )}

          {/* Unified Settings & Tools Dropdown Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
              title="Tools & Workspace Settings"
              className={`flex items-center gap-1.5 p-2.5 sm:px-3 sm:py-2 rounded-xl border transition-all cursor-pointer shadow-2xs min-h-[42px] ${
                isSettingsMenuOpen
                  ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                  : 'bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline text-xs font-semibold">Settings</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isSettingsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Content */}
            {isSettingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Workspace Actions
                  </span>
                </div>

                <div className="p-1 space-y-0.5">
                  {/* QA Sprint Report */}
                  {onOpenQAReport && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenQAReport();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">QA Sprint Report</div>
                        <div className="text-[10px] text-slate-500">Test pass rate, bugs & markdown audit</div>
                      </div>
                    </button>
                  )}

                  {/* Live Spec Editor */}
                  {liveSpecEditingEnabled && onOpenLiveSpec && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenLiveSpec();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Code2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Edit OpenAPI Spec</div>
                        <div className="text-[10px] text-slate-500">Live JSON/YAML modification & history</div>
                      </div>
                    </button>
                  )}

                  {/* Security Audit */}
                  {securityAuditEnabled && onOpenSecurityAudit && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenSecurityAudit();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Run Security Audit</div>
                        <div className="text-[10px] text-slate-500">OWASP compliance & vulnerability scan</div>
                      </div>
                    </button>
                  )}

                  {/* AI DeepSeek Tests */}
                  {onOpenAITests && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenAITests();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">AI Test Studio</div>
                        <div className="text-[10px] text-slate-500">DeepSeek v4.1 & Multi-LLM test synthesis</div>
                      </div>
                    </button>
                  )}

                  {/* Export Client SDK */}
                  {onOpenSDKGenerator && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenSDKGenerator();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Export Client SDK</div>
                        <div className="text-[10px] text-slate-500">Generate TypeScript, Go, Python packages</div>
                      </div>
                    </button>
                  )}

                  {/* Schema Importer */}
                  {writesEnabled && onOpenImporter && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenImporter();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Import OpenAPI Spec</div>
                        <div className="text-[10px] text-slate-500">Upload JSON/YAML or fetch URL</div>
                      </div>
                    </button>
                  )}

                  {/* SaaS Tenant Hub */}
                  {onOpenTenantSettings && (
                    <button
                      onClick={() => {
                        setIsSettingsMenuOpen(false);
                        onOpenTenantSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Sliders className="w-4 h-4 text-sky-500 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Tenant & Billing Hub</div>
                        <div className="text-[10px] text-slate-500">Quotas, white-label themes & Stripe</div>
                      </div>
                    </button>
                  )}
                </div>

                <div className="px-3 py-1.5 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">v2.0 Enterprise</span>
                  <a
                    href="/docs/logout"
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Lock Session</span>
                  </a>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


