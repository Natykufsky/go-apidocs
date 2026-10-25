import React from 'react';
import {
  Home,
  BookOpen,
  Zap,
  Activity,
  FileJson,
  FileCode,
  ShieldCheck,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Lock,
  KeyRound,
  Sun,
  Moon,
  Globe,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { NavItem, NavConfig } from './Navbar';
import { Workspace } from './WorkspaceSwitcher';
import { useTheme } from '../context/ThemeContext';

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
  onOpenQAReport?: () => void;
  hasCredentials?: boolean;
  activeModule?: string;
  availableModules?: string[];
  onSelectModule?: (mod: string) => void;
  activeEnv?: string;
  onSelectEnv?: (env: string) => void;
  maskPII?: boolean;
  onToggleMaskPII?: () => void;
}

const navIconFor = (url: string) => {
  if (url === '/') return Home;
  if (url.startsWith('/guide')) return BookOpen;
  if (url.startsWith('/docs')) return Zap;
  if (url.startsWith('/dashboard') || url.startsWith('/health')) return Activity;
  if (url.endsWith('.json') || url.endsWith('.yaml')) return FileJson;
  return FileCode;
};

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
  onOpenQAReport,
  hasCredentials = false,
  activeModule = 'all',
  availableModules = [],
  onSelectModule,
  activeEnv = 'default',
  onSelectEnv,
  maskPII = false,
  onToggleMaskPII,
}) => {
  const { toggle: toggleTheme, isDark: isDarkMode } = useTheme();

  const isCurrentActive = (url: string) => {
    if (url === '/' && (currentPath === '/' || currentPath === '' || currentPath === '/landing')) return true;
    if (url === '/docs' && (currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger')) return true;
    if (url === '/guide' && currentPath.startsWith('/guide')) return true;
    if (url === '/dashboard' && (currentPath === '/dashboard' || currentPath === '/health')) return true;
    return currentPath === url;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLElement>, item: NavItem) => {
    if (item.external || item.url.endsWith('.json') || item.url.startsWith('http') || item.url.includes('/logout')) return;
    e.preventDefault();
    onNavigate(item.url);
    onCloseMobile();
  };

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSvc = activeWs?.services?.find((s) => s.id === activeServiceId) || activeWs?.services?.[0];
  const envKeys = activeSvc?.environments && Object.keys(activeSvc.environments).length > 0
    ? Object.keys(activeSvc.environments)
    : [];

  const brandLabel =
    (config.title || 'go').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toLowerCase() || 'go';
  const Row: React.FC<{
    active?: boolean;
    isPrimary?: boolean;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    href?: string;
    title?: string;
    Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    badge?: React.ReactNode;
    external?: boolean;
  }> = ({ active, isPrimary, onClick, href, title, Icon, label, badge, external }) => {
    const baseStyle: React.CSSProperties = isPrimary
      ? { background: 'var(--accent-500)', color: '#04161C', fontWeight: 600 }
      : active
        ? {
          background: 'var(--accent-muted)',
          color: 'var(--accent-500)',
          fontWeight: 500,
          boxShadow: 'inset 3px 0 0 var(--accent-500)',
        }
        : { background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500 };

    const handleEnter = (e: React.MouseEvent<HTMLElement>) => {
      if (!active && !isPrimary) {
        e.currentTarget.style.background = 'var(--bg-hover)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }
    };
    const handleLeave = (e: React.MouseEvent<HTMLElement>) => {
      if (!active && !isPrimary) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }
    };

    const content = (
      <>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Icon className="w-[15px] h-[15px] shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </div>
        {!collapsed && (badge || external) && (
          <span className="flex items-center gap-1 shrink-0">
            {badge}
            {external && (
              <ExternalLink className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </span>
        )}
      </>
    );

    const cls = `w-full flex items-center h-8 px-2.5 rounded-[var(--r-sm)] text-[13px] transition-all duration-150 ${collapsed ? 'justify-center' : ''
      }`;

    if (href) {
      return (
        <a
          href={href}
          onClick={onClick}
          title={title || label}
          className={cls}
          style={baseStyle}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {content}
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || label}
        className={cls}
        style={baseStyle}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {content}
      </button>
    );
  };

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    collapsed ? null : (
      <div
        className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
      >
        {children}
      </div>
    );

  const sidebarContent = (
    <div className="h-full flex flex-col select-none overflow-hidden">
      {/* header */}
      <div
        className="shrink-0 border-b"
        style={{ borderColor: 'var(--border-subtle)', padding: collapsed ? '10px 6px' : '12px' }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, { label: 'Home', url: '/' })}
              title={config.title}
              className="grid place-items-center w-8 h-8 rounded-[6px] shrink-0"
              style={{
                background: 'linear-gradient(145deg, var(--accent-400), var(--accent-500))',
                color: '#04161C',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(34,211,238,0.25)',
              }}
            >
              {brandLabel}
            </a>
            <button
              onClick={onToggleCollapse}
              className="grid place-items-center w-6 h-6 rounded-[4px] transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-[14px] h-[14px]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, { label: 'Home', url: '/' })}
              className="flex items-center gap-2.5 min-w-0 shrink-0"
              title={config.title}
            >
              <div
                className="w-8 h-8 rounded-[6px] grid place-items-center shrink-0"
                style={{
                  background: 'linear-gradient(145deg, var(--accent-400), var(--accent-500))',
                  color: '#04161C',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(34,211,238,0.25)',
                }}
              >
                {brandLabel}
              </div>
              <div className="text-[13px] font-semibold leading-none truncate" style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>
                {config.title || 'API Platform'}
              </div>
            </a>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:grid place-items-center w-7 h-7 rounded-[var(--r-sm)] transition-colors shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-[15px] h-[15px]" />
            </button>
            <button
              onClick={onCloseMobile}
              className="lg:hidden grid place-items-center w-7 h-7 rounded-[var(--r-sm)] transition-colors shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              title="Close"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* scroll */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {onOpenSearch && !collapsed && (
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2 h-8 px-2.5 mb-1 rounded-[var(--r-sm)] transition-colors"
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
              fontSize: 12,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            <span>Search…</span>
            <span className="ml-auto kbd">⌘K</span>
          </button>
        )}

        <SectionTitle>Overview</SectionTitle>
        <div className="space-y-0.5">
          {config.nav_items?.map((item) => {
            const Icon = navIconFor(item.url);
            const active = isCurrentActive(item.url);
            return (
              <Row
                key={item.label}
                Icon={Icon}
                label={item.label}
                active={active}
                isPrimary={!!item.is_button}
                href={item.url}
                onClick={(e) => handleLinkClick(e, item)}
                external={item.external}
              />
            );
          })}
        </div>

        {(onOpenAITests || onOpenQAReport || (securityAuditEnabled && onOpenSecurityAudit)) && (
          <>
            <SectionTitle>Quality</SectionTitle>
            <div className="space-y-0.5">
              {onOpenAITests && (
                <Row
                  Icon={Sparkles}
                  label="AI Tests"
                  onClick={() => { onOpenAITests(); onCloseMobile(); }}
                  badge={<span className="pill pill--accent" style={{ height: 16, fontSize: 9, padding: '0 5px' }}>AI</span>}
                />
              )}
              {onOpenQAReport && (
                <Row Icon={FileSpreadsheet} label="QA Report" onClick={() => { onOpenQAReport(); onCloseMobile(); }} />
              )}
              {securityAuditEnabled && onOpenSecurityAudit && (
                <Row Icon={ShieldCheck} label="Security Audit" onClick={() => { onOpenSecurityAudit(); onCloseMobile(); }} />
              )}
            </div>
          </>
        )}

        {(writesEnabled && onOpenImporter) || onOpenCredentials || onToggleMaskPII ? (
          <>
            <SectionTitle>Workspace</SectionTitle>
            <div className="space-y-0.5">
              {writesEnabled && onOpenImporter && (
                <Row Icon={UploadCloud} label="Import Spec" onClick={() => { onOpenImporter(); onCloseMobile(); }} />
              )}
              {onOpenCredentials && (
                <Row
                  Icon={KeyRound}
                  label="Auth"
                  onClick={() => { onOpenCredentials(); onCloseMobile(); }}
                  badge={hasCredentials ? (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
                  ) : undefined}
                />
              )}
              {onToggleMaskPII && (
                <Row
                  Icon={maskPII ? EyeOff : Eye}
                  label="Mask PII"
                  onClick={onToggleMaskPII}
                  badge={maskPII ? (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-500)' }} />
                  ) : undefined}
                />
              )}
              <a
                href={`/docs/swagger.json?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`}
                download={`${activeSvc?.title || 'api'}-spec.json`}
                title="Export OpenAPI spec"
                className={`flex items-center h-8 px-2.5 rounded-[var(--r-sm)] text-[13px] transition-all duration-150 ${collapsed ? 'justify-center' : ''
                  }`}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Download className="w-[15px] h-[15px] shrink-0" />
                  {!collapsed && <span className="truncate">Export JSON</span>}
                </div>
              </a>
            </div>
          </>
        ) : null}

        {envKeys.length > 0 && onSelectEnv && (
          <>
            <SectionTitle>Environment</SectionTitle>
            {!collapsed ? (
              <div
                className="flex p-[3px] rounded-[var(--r-sm)] gap-[2px] mb-1"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {envKeys.map((envKey) => {
                  const isActive = activeEnv === envKey;
                  return (
                    <button
                      key={envKey}
                      type="button"
                      onClick={() => onSelectEnv(envKey)}
                      title={activeSvc?.environments?.[envKey]}
                      className="flex-1 h-6 px-1.5 rounded-[4px] text-[10.5px] font-medium uppercase truncate transition-all"
                      style={{
                        background: isActive ? 'var(--bg-hover)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
                      }}
                    >
                      {envKey}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-center py-1" title={`Env: ${activeEnv}`}>
                <Globe className="w-[15px] h-[15px]" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            )}
          </>
        )}

        {availableModules.length > 0 && onSelectModule && !collapsed && (
          <>
            <SectionTitle>Modules</SectionTitle>
            <div className="space-y-0.5 max-h-40 overflow-y-auto pr-0.5">
              <Row
                Icon={() => <span className="w-[15px] h-[15px] grid place-items-center" style={{ color: 'var(--text-tertiary)' }}>•</span>}
                label="All Modules"
                active={activeModule === 'all'}
                onClick={() => onSelectModule('all')}
              />
              {availableModules.slice(0, 10).map((m) => (
                <Row
                  key={m}
                  Icon={() => <span className="w-[15px] h-[15px] grid place-items-center" style={{ color: 'var(--text-tertiary)' }}>•</span>}
                  label={m}
                  active={activeModule === m}
                  onClick={() => onSelectModule(m)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* footer */}
      <div
        className="shrink-0 border-t px-2 py-2"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span className="mono text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
              v{__APP_VERSION__}
            </span>
            <div className="flex items-center gap-0.5">
              <FooterIcon
                onClick={toggleTheme}
                title={isDarkMode ? 'Light mode' : 'Dark mode'}
                Icon={isDarkMode ? Sun : Moon}
              />
              <a
                href="/docs/logout"
                title="Lock session"
                className="grid place-items-center w-7 h-7 rounded-[var(--r-sm)] transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--danger-500)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                <Lock className="w-[14px] h-[14px]" />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <FooterIcon onClick={toggleTheme} title={isDarkMode ? 'Light mode' : 'Dark mode'} Icon={isDarkMode ? Sun : Moon} large />
            <a
              href="/docs/logout"
              title="Lock session"
              className="grid place-items-center w-8 h-8 rounded-[var(--r-sm)] transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--danger-500)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <Lock className="w-[15px] h-[15px]" />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r transition-[width] duration-200 ease-out z-40 sticky top-0 h-screen ${collapsed ? 'w-14' : 'w-56'
          }`}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0"
            style={{ background: 'rgba(5,5,7,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={onCloseMobile}
          />
          <div
            className="relative flex-1 flex flex-col max-w-[260px] w-full z-10 h-full overflow-hidden border-r"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

const FooterIcon: React.FC<{
  onClick: () => void;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  large?: boolean;
}> = ({ onClick, title, Icon, large }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`grid place-items-center rounded-[var(--r-sm)] transition-colors ${large ? 'w-8 h-8' : 'w-7 h-7'}`}
    style={{ color: 'var(--text-tertiary)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--bg-hover)';
      e.currentTarget.style.color = 'var(--text-primary)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--text-tertiary)';
    }}
  >
    <Icon className={large ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]'} />
  </button>
);