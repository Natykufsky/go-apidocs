import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
  Plus,
  ShieldCheck,
  Settings,
  Lock,
  Unlock,
  Folder,
  FileCode,
  Search,
} from 'lucide-react';

export interface APIService {
  id: string;
  title: string;
  version?: string;
  description?: string;
  icon?: string;
  environments?: Record<string, string>;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  visibility?: 'public' | 'internal' | 'locked';
  is_locked?: boolean;
  is_unlocked?: boolean;
  passcode?: string;
  services: APIService[];
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeServiceId: string;
  writesEnabled: boolean;
  onSelectService: (workspaceId: string, serviceId: string) => void;
  onOpenImporter?: () => void;
  onOpenSecurityAudit?: () => void;
  onOpenManager?: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  activeServiceId,
  writesEnabled,
  onSelectService,
  onOpenImporter,
  onOpenSecurityAudit,
  onOpenManager,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSvc = activeWs?.services?.find((s) => s.id === activeServiceId) || activeWs?.services?.[0];

  const filteredWorkspaces = workspaces
    .map((w) => ({
      ...w,
      services: w.services.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.id.toLowerCase().includes(search.toLowerCase()) ||
          w.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((w) => w.services.length > 0 || w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 h-8 px-2.5 rounded-[var(--r-sm)] transition-all duration-150"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.background = 'var(--bg-raised)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.background = 'var(--bg-surface)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        title="Switch workspace or API"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <div className="flex items-center gap-1 min-w-0 flex-1 truncate text-[12px]">
            <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
              {activeWs?.name || 'Workspace'}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
              {activeSvc?.title || 'API'}
            </span>
          </div>
        </div>
        <ChevronDown
          className="w-3 h-3 shrink-0 transition-transform duration-150"
          style={{
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] w-72 rounded-[var(--r-lg)] z-[100] overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Search */}
          <div className="p-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="text"
                placeholder="Search workspaces & APIs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 rounded-[var(--r-sm)] text-[12px]"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredWorkspaces.map((ws) => (
              <div key={ws.id} className="mb-1.5 last:mb-0">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase"
                  style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                >
                  <span className="truncate flex-1">{ws.name}</span>
                  {ws.is_locked && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium normal-case"
                      style={ws.is_unlocked === false
                        ? {
                            background: 'color-mix(in srgb, var(--warning-500) 10%, transparent)',
                            color: 'var(--warning-500)',
                            border: '1px solid color-mix(in srgb, var(--warning-500) 24%, transparent)',
                          }
                        : {
                            background: 'var(--bg-overlay)',
                            color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                    >
                      {ws.is_unlocked === false ? (
                        <>
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </>
                      ) : (
                        <>
                          <Unlock className="w-2.5 h-2.5" />
                          Open
                        </>
                      )}
                    </span>
                  )}
                </div>
                {ws.services.map((svc) => {
                  const isSelected = ws.id === activeWorkspaceId && svc.id === activeServiceId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        onSelectService(ws.id, svc.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2 h-8 px-2 rounded-[var(--r-sm)] text-left text-[12.5px] transition-all"
                      style={{
                        background: isSelected ? 'var(--accent-muted)' : 'transparent',
                        color: isSelected ? 'var(--accent-500)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <FileCode className="w-3 h-3 shrink-0" />
                      <span className="truncate flex-1">{svc.title}</span>
                      {svc.version && (
                        <span className="mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                          v{svc.version}
                        </span>
                      )}
                      {isSelected && <Check className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-500)' }} />}
                    </button>
                  );
                })}
              </div>
            ))}
            {filteredWorkspaces.length === 0 && (
              <div className="p-3 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                No results
              </div>
            )}
          </div>

          {/* Footer */}
          {(onOpenImporter || onOpenManager || onOpenSecurityAudit) && (
            <div className="p-1.5 flex items-center gap-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {onOpenImporter && writesEnabled && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenImporter(); }}
                  className="flex-1 flex items-center justify-center gap-1 h-7 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-all"
                  style={{
                    background: 'var(--accent-500)',
                    color: '#04161C',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-300)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-500)'; }}
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              )}
              {onOpenManager && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenManager(); }}
                  className="flex items-center justify-center gap-1 h-7 px-2 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-all"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-canvas)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  title="Manage workspaces"
                >
                  <Settings className="w-3 h-3" />
                  Manage
                </button>
              )}
              {onOpenSecurityAudit && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenSecurityAudit(); }}
                  className="flex items-center justify-center h-7 w-7 rounded-[var(--r-sm)] transition-all"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-canvas)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                  title="Security audit"
                >
                  <ShieldCheck className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};