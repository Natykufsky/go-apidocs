import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Lock,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  KeyRound,
  EyeOff,
  Sliders,
  Settings,
  UploadCloud,
  Layers,
  Code2,
  FileSpreadsheet,
  Rows3,
  Rows4,
  Home,
  BookOpen,
  Zap,
  Activity,
  FileJson,
  CircleDot,
} from 'lucide-react';
import { Workspace, WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useTheme } from '../context/ThemeContext';

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

const getPageMeta = (path: string) => {
  if (path === '/' || path === '' || path === '/landing')
    return { title: 'Overview', Icon: Home };
  if (path === '/docs' || path === '/docs/index.html' || path === '/swagger')
    return { title: 'Sandbox', Icon: Zap };
  if (path.startsWith('/guide')) return { title: 'Guide', Icon: BookOpen };
  if (path === '/dashboard' || path === '/health')
    return { title: 'Health', Icon: Activity };
  return { title: 'Explorer', Icon: FileJson };
};

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
  onOpenCredentials,
  onOpenQAReport,
  hasCredentials = false,
  activeEnv = 'default',
  maskPII = false,
  onOpenSearch,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useTheme();

  const { density, setDensity } = useTheme();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { title: pageTitle, Icon: PageIcon } = getPageMeta(currentPath);
  const isProd = /prod|production/i.test(activeEnv || '');
  const showEnv = activeEnv && activeEnv !== 'default';

  const brandLabel =
    (config.title || 'go').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toLowerCase() || 'go';

  const iconBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--r-sm)',
    height: 32,
    width: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    transition: 'all 0.15s var(--ease)',
  };

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-2 px-3 sm:px-4"
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* mobile toggle */}
      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden"
        style={iconBtn}
        aria-label="Open navigation"
      >
        <Menu className="w-[16px] h-[16px]" />
      </button>

      {/* brand — mobile only */}
      <a
        href="/"
        className="lg:hidden flex items-center gap-2.5 shrink-0 min-w-0"
        title={config.title}
      >
        <div
          className="w-[28px] h-[28px] rounded-[6px] grid place-items-center shrink-0"
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
        <span
          className="hidden sm:inline text-[13px] font-semibold leading-none truncate max-w-[180px]"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          {config.title || 'API Platform'}
        </span>
      </a>

      <div
        className="hidden lg:block h-5 w-px shrink-0"
        style={{ background: 'var(--border-subtle)' }}
      />

      {workspaces.length > 0 && onSelectService && (
        <div className="shrink-0 max-w-[180px]">
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

      <div
        className="hidden md:flex items-center gap-1.5 text-[12px] shrink-0 pl-1"
        aria-label="Breadcrumb"
      >
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <PageIcon className="w-[13px] h-[13px]" style={{ color: 'var(--text-tertiary)' }} />
          {pageTitle}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 shrink-0">
        {showEnv && (
          <div
            className="hidden lg:inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--r-sm)]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
            title={`Environment: ${activeEnv}`}
          >
            <span
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{
                background: isProd ? 'var(--danger-500)' : 'var(--success-500)',
                boxShadow: isProd ? '0 0 8px var(--danger-500)' : '0 0 6px color-mix(in srgb, var(--success-500) 50%, transparent)',
              }}
            />
            {activeEnv}
          </div>
        )}

        {maskPII && (
          <div
            className="hidden xl:inline-flex items-center gap-1.5 h-7 px-2 rounded-[var(--r-sm)]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
            }}
            title="PII masking active"
          >
            <EyeOff className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            Masked
          </div>
        )}

        {onOpenCredentials && (
          <button
            onClick={onOpenCredentials}
            title={hasCredentials ? 'Auth configured' : 'Configure auth'}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-raised)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
          >
            {hasCredentials ? (
              <CircleDot className="w-[13px] h-[13px]" style={{ color: 'var(--success-500)' }} />
            ) : (
              <KeyRound className="w-[13px] h-[13px]" />
            )}
            <span className="hidden md:inline">{hasCredentials ? 'Auth' : 'No auth'}</span>
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Settings"
            style={{
              ...iconBtn,
              background: menuOpen ? 'var(--bg-hover)' : 'transparent',
              color: menuOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
            aria-expanded={menuOpen}
          >
            <Settings className="w-[15px] h-[15px]" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-[280px] rounded-[var(--r-lg)] py-1 z-50 overflow-hidden"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <SectionLabel>Actions</SectionLabel>
              <div className="px-1">
                {onOpenSearch && (
                  <MenuRow
                    icon={<Sparkles className="w-4 h-4" />}
                    title="Search"
                    sub="Endpoints, tests, findings"
                    onClick={() => { setMenuOpen(false); onOpenSearch(); }}
                  />
                )}
                {onOpenQAReport && (
                  <MenuRow
                    icon={<FileSpreadsheet className="w-4 h-4" />}
                    title="QA Report"
                    sub="Test results & audit"
                    onClick={() => { setMenuOpen(false); onOpenQAReport(); }}
                  />
                )}
                {liveSpecEditingEnabled && onOpenLiveSpec && (
                  <MenuRow
                    icon={<Code2 className="w-4 h-4" />}
                    title="Edit Spec"
                    sub="Live JSON/YAML editing"
                    onClick={() => { setMenuOpen(false); onOpenLiveSpec(); }}
                  />
                )}
                {securityAuditEnabled && onOpenSecurityAudit && (
                  <MenuRow
                    icon={<ShieldCheck className="w-4 h-4" />}
                    title="Security Audit"
                    sub="OWASP compliance scan"
                    onClick={() => { setMenuOpen(false); onOpenSecurityAudit(); }}
                  />
                )}
                {onOpenAITests && (
                  <MenuRow
                    icon={<Sparkles className="w-4 h-4" />}
                    title="AI Test Studio"
                    sub="Synthesize test suites"
                    onClick={() => { setMenuOpen(false); onOpenAITests(); }}
                  />
                )}
                {onOpenSDKGenerator && (
                  <MenuRow
                    icon={<Layers className="w-4 h-4" />}
                    title="Export SDK"
                    sub="TypeScript · Go · Python"
                    onClick={() => { setMenuOpen(false); onOpenSDKGenerator(); }}
                  />
                )}
                {writesEnabled && onOpenImporter && (
                  <MenuRow
                    icon={<UploadCloud className="w-4 h-4" />}
                    title="Import Spec"
                    sub="Upload or fetch OpenAPI"
                    onClick={() => { setMenuOpen(false); onOpenImporter(); }}
                  />
                )}
                {onOpenTenantSettings && (
                  <MenuRow
                    icon={<Sliders className="w-4 h-4" />}
                    title="Tenant Settings"
                    sub="Quotas, themes, billing"
                    onClick={() => { setMenuOpen(false); onOpenTenantSettings(); }}
                  />
                )}
              </div>

              <div className="mt-1 pt-2 px-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <SectionLabel>Density</SectionLabel>
                <div className="flex gap-1 pb-1">
                  {(['comfortable', 'compact'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className="flex-1 h-7 rounded-[var(--r-sm)] text-[11.5px] font-medium flex items-center justify-center gap-1.5 transition-all"
                      style={{
                        background: density === d ? 'var(--bg-hover)' : 'transparent',
                        color: density === d ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      {d === 'compact' ? <Rows4 className="w-3 h-3" /> : <Rows3 className="w-3 h-3" />}
                      {d === 'compact' ? 'Compact' : 'Comfortable'}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="mt-1 pt-1.5 px-3 py-1.5 flex items-center justify-between text-[11px]"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <span className="mono" style={{ color: 'var(--text-tertiary)' }}>
                  v{__APP_VERSION__}
                </span>
                <a
                  href="/docs/logout"
                  className="inline-flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Lock className="w-3 h-3" />
                  Lock
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase"
    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
  >
    {children}
  </div>
);

const MenuRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}> = ({ icon, title, sub, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-[var(--r-sm)] text-left transition-colors"
    style={{ color: 'var(--text-secondary)' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--text-tertiary)' }}>
        {sub}
      </div>
    </div>
  </button>
);