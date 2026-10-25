import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  CornerDownLeft,
  Tag,
  Sparkles,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { QARecord } from './QAReportModal';

interface SearchItem {
  type: 'endpoint' | 'module' | 'nav' | 'action';
  title: string;
  subtitle?: string;
  method?: string;
  path?: string;
  badge?: string;
  qaStatus?: 'passed' | 'retest' | 'failed' | 'untested';
  action: () => void;
}

interface SpotlightSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allEndpoints: string[];
  qaData: Record<string, QARecord>;
  availableModules: string[];
  navItems: Array<{ label: string; url: string; icon?: string }>;
  onNavigate: (path: string) => void;
  onSelectModule: (mod: string) => void;
  onInspectEndpoint: (endpoint: string) => void;
}

/* ---------- method pill ---------- */
const methodPill = (m: string): React.CSSProperties => {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    GET: {
      fg: 'var(--info-500)',
      bg: 'color-mix(in srgb, var(--info-500) 14%, transparent)',
      bd: 'color-mix(in srgb, var(--info-500) 28%, transparent)',
    },
    POST: {
      fg: 'var(--success-500)',
      bg: 'color-mix(in srgb, var(--success-500) 14%, transparent)',
      bd: 'color-mix(in srgb, var(--success-500) 28%, transparent)',
    },
    PUT: {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 14%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 28%, transparent)',
    },
    PATCH: {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 14%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 28%, transparent)',
    },
    DELETE: {
      fg: 'var(--danger-500)',
      bg: 'color-mix(in srgb, var(--danger-500) 14%, transparent)',
      bd: 'color-mix(in srgb, var(--danger-500) 28%, transparent)',
    },
  };
  const c = map[m.toUpperCase()] || {
    fg: 'var(--text-secondary)',
    bg: 'var(--bg-overlay)',
    bd: 'var(--border-subtle)',
  };
  return {
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.bd}`,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase' as const,
    lineHeight: 1.4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
    flexShrink: 0,
  };
};

/* ---------- qa status dot ---------- */
const qaDotColor = (s?: string) =>
  s === 'passed'
    ? 'var(--success-500)'
    : s === 'retest'
    ? 'var(--warning-500)'
    : s === 'failed'
    ? 'var(--danger-500)'
    : 'var(--text-tertiary)';

/* ---------- query highlighter ---------- */
const Highlighted: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: 'var(--accent-muted)',
          color: 'var(--accent-500)',
          padding: 0,
          borderRadius: 2,
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
};

/* ---------- section grouping ---------- */
type Section = {
  type: 'nav' | 'module' | 'endpoint';
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  items: SearchItem[];
};

export const SpotlightSearchModal: React.FC<SpotlightSearchModalProps> = ({
  isOpen,
  onClose,
  allEndpoints,
  qaData,
  availableModules,
  navItems,
  onNavigate,
  onSelectModule,
  onInspectEndpoint,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  /* ---- build searchable items ---- */
  const allItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    // Pages
    navItems.forEach((item) => {
      items.push({
        type: 'nav',
        title: item.label,
        subtitle: item.url,
        badge: 'Page',
        action: () => {
          onNavigate(item.url);
          onClose();
        },
      });
    });

    // Modules
    availableModules.forEach((mod) => {
      items.push({
        type: 'module',
        title: mod,
        badge: 'Module',
        action: () => {
          onSelectModule(mod);
          onNavigate('/docs');
          onClose();
        },
      });
    });

    // Endpoints
    const endpointSet = new Set<string>([...allEndpoints, ...Object.keys(qaData)]);
    endpointSet.forEach((ep) => {
      const parts = ep.split(' ');
      const method = (parts[0] || 'GET').toUpperCase();
      const path = parts.slice(1).join(' ') || ep;
      const record = qaData[ep];
      items.push({
        type: 'endpoint',
        title: path,
        subtitle: record?.comment ? record.comment : undefined,
        method,
        path,
        qaStatus: record?.status || 'untested',
        action: () => {
          onInspectEndpoint(ep);
          onClose();
        },
      });
    });

    return items;
  }, [navItems, availableModules, allEndpoints, qaData, onNavigate, onSelectModule, onInspectEndpoint, onClose]);

  /* ---- filter + group ---- */
  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();

    // Filter
    let matches = allItems;
    if (q) {
      matches = allItems.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q) ||
          item.method?.toLowerCase().includes(q) ||
          item.path?.toLowerCase().includes(q)
        );
      });
    }

    // Score & sort (prefix > word-boundary > substring), per type
    const scoreItem = (item: SearchItem): number => {
      if (!q) return 0;
      const t = item.title.toLowerCase();
      const p = item.path?.toLowerCase() || '';
      const m = item.method?.toLowerCase() || '';
      if (t === q || p === q) return 100;
      if (t.startsWith(q) || p.startsWith(q)) return 80;
      if (t.includes(q) || p.includes(q) || m.includes(q)) return 40;
      return 0;
    };
    matches = [...matches].sort((a, b) => scoreItem(b) - scoreItem(a));

    // Group
    const byType: Record<string, SearchItem[]> = { nav: [], module: [], endpoint: [] };
    matches.forEach((i) => byType[i.type]?.push(i));

    // Caps when empty
    const caps = { nav: 5, module: 8, endpoint: 10 };
    if (!q) {
      byType.nav = byType.nav.slice(0, caps.nav);
      byType.module = byType.module.slice(0, caps.module);
      byType.endpoint = byType.endpoint.slice(0, caps.endpoint);
    }

    const out: Section[] = [];
    if (byType.nav.length > 0)
      out.push({ type: 'nav', label: 'Pages', Icon: FileCode, items: byType.nav });
    if (byType.module.length > 0)
      out.push({ type: 'module', label: 'Modules', Icon: Tag, items: byType.module });
    if (byType.endpoint.length > 0)
      out.push({ type: 'endpoint', label: 'Endpoints', Icon: Sparkles, items: byType.endpoint });
    return out;
  }, [allItems, query]);

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1 < flatItems.length ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 >= 0 ? i - 1 : Math.max(0, flatItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatItems[selectedIndex]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flatItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const totalResults = flatItems.length;
  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[10vh] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ animation: 'spot-fade 160ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
    >
      {/* Backdrop — glass, matching Modal.tsx */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: 'color-mix(in srgb, #000000 45%, transparent)',
          backdropFilter: 'blur(14px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-[640px] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          boxShadow:
            'var(--shadow-xl), 0 1px 0 rgba(255, 255, 255, 0.04) inset',
          animation: 'spot-pop 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <Search
            className="w-[15px] h-[15px] shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search endpoints, modules, pages…"
            className="flex-1 bg-transparent outline-none border-0 text-[14px]"
            style={{ color: 'var(--text-primary)' }}
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="shrink-0 grid place-items-center w-6 h-6 rounded transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="kbd shrink-0">⌘K</span>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-1.5"
          style={{ maxHeight: 'min(60vh, 420px)' }}
        >
          {totalResults === 0 ? (
            <div className="py-14 px-6 text-center">
              <div
                className="w-10 h-10 rounded-full grid place-items-center mx-auto mb-3"
                style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search
                  className="w-4 h-4"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </div>
              <div
                className="text-[13px] font-medium mb-1"
                style={{ color: 'var(--text-primary)' }}
              >
                No results for “{query}”
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                Try{' '}
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  get
                </span>
                ,{' '}
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  auth
                </span>
                , or a module name.
              </div>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.type} className="mb-1">
                {/* section header */}
                <div
                  className="flex items-center gap-1.5 px-3.5 pt-2 pb-1"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <section.Icon className="w-[11px] h-[11px]" />
                  <span
                    className="text-[10px] font-semibold uppercase"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {section.label}
                  </span>
                  <span
                    className="mono text-[10px] ml-1"
                    style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}
                  >
                    {section.items.length}
                  </span>
                </div>

                {/* section rows */}
                {section.items.map((item) => {
                  const idx = globalIndex++;
                  const isSelected = idx === selectedIndex;
                  const isEndpoint = item.type === 'endpoint' && item.method;
                  return (
                    <button
                      key={`${item.type}-${item.title}-${idx}`}
                      type="button"
                      data-index={idx}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 mx-1.5 rounded-[var(--r-sm)] text-left transition-colors"
                      style={{
                        width: 'calc(100% - 12px)',
                        background: isSelected ? 'var(--bg-hover)' : 'transparent',
                        boxShadow: isSelected
                          ? 'inset 2px 0 0 var(--accent-500)'
                          : 'none',
                      }}
                    >
                      {/* left indicator */}
                      {isEndpoint ? (
                        <span style={methodPill(item.method!)}>{item.method}</span>
                      ) : item.type === 'module' ? (
                        <span
                          className="grid place-items-center w-7 h-7 rounded-[6px] shrink-0"
                          style={{
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          <Tag className="w-3 h-3" />
                        </span>
                      ) : (
                        <span
                          className="grid place-items-center w-7 h-7 rounded-[6px] shrink-0"
                          style={{
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          <FileCode className="w-3 h-3" />
                        </span>
                      )}

                      {/* text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`truncate ${
                              isEndpoint ? 'mono text-[12px]' : 'text-[13px]'
                            }`}
                            style={{
                              color: 'var(--text-primary)',
                              fontWeight: isEndpoint ? 500 : 500,
                            }}
                          >
                            <Highlighted text={item.title} query={query} />
                          </span>
                        </div>
                        {item.subtitle && (
                          <div
                            className="text-[11.5px] truncate mt-0.5"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <Highlighted text={item.subtitle} query={query} />
                          </div>
                        )}
                      </div>

                      {/* right indicator */}
                      {isEndpoint ? (
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                          title={`QA: ${item.qaStatus || 'untested'}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: qaDotColor(item.qaStatus) }}
                          />
                        </span>
                      ) : isSelected ? (
                        <CornerDownLeft
                          className="w-3 h-3 shrink-0"
                          style={{ color: 'var(--text-tertiary)' }}
                        />
                      ) : (
                        <ArrowRight
                          className="w-3 h-3 shrink-0 opacity-0 transition-opacity"
                          style={{
                            color: 'var(--text-tertiary)',
                            opacity: isSelected ? 1 : 0,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2"
          style={{
            background: 'var(--bg-canvas)',
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div className="flex items-center gap-3 mono text-[10.5px]">
            <span className="inline-flex items-center gap-1">
              <span className="kbd">↑</span>
              <span className="kbd">↓</span>
              <span className="ml-1">navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="kbd">↵</span>
              <span className="ml-1">select</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="kbd">esc</span>
              <span className="ml-1">close</span>
            </span>
          </div>
          <div className="mono text-[10.5px] inline-flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-500)' }} />
            {totalResults} {totalResults === 1 ? 'result' : 'results'}
          </div>
        </div>
      </div>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes spot-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spot-pop {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="spot-fade"],
          [style*="spot-pop"] {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};