import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  CornerDownLeft,
  X,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Tag,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { QARecord } from './QAReportModal';

interface SearchItem {
  type: 'endpoint' | 'module' | 'nav' | 'action';
  title: string;
  subtitle?: string;
  method?: string;
  path?: string;
  badge?: string;
  badgeColor?: string;
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

  // Focus search input whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build searchable items list
  const allItems: SearchItem[] = [];

  // 1. Navigation Pages
  navItems.forEach((item) => {
    allItems.push({
      type: 'nav',
      title: item.label,
      subtitle: `Portal Page • ${item.url}`,
      badge: 'Page',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      action: () => {
        onNavigate(item.url);
        onClose();
      },
    });
  });

  // 2. Modules / Tags
  availableModules.forEach((mod) => {
    allItems.push({
      type: 'module',
      title: mod,
      subtitle: `Filter Swagger Scope by Module/Tag`,
      badge: 'Module',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      action: () => {
        onSelectModule(mod);
        onNavigate('/docs');
        onClose();
      },
    });
  });

  // 3. API Endpoints
  const endpointSet = new Set<string>([...allEndpoints, ...Object.keys(qaData)]);
  endpointSet.forEach((ep) => {
    const parts = ep.split(' ');
    const method = parts[0] || 'GET';
    const path = parts.slice(1).join(' ') || ep;
    const record = qaData[ep];

    let badgeColor = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    if (record?.status === 'passed') badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (record?.status === 'retest') badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    else if (record?.status === 'failed') badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

    allItems.push({
      type: 'endpoint',
      title: path,
      subtitle: record?.comment ? `Note: "${record.comment}"` : undefined,
      method: method.toUpperCase(),
      path: path,
      badge: record?.status ? record.status.toUpperCase() : 'UNTESTED',
      badgeColor,
      qaStatus: record?.status || 'untested',
      action: () => {
        onInspectEndpoint(ep);
        onClose();
      },
    });
  });

  // Filter items according to search query
  const cleanQuery = query.trim().toLowerCase();
  const filteredItems = cleanQuery
    ? allItems.filter((item) => {
        const matchTitle = item.title.toLowerCase().includes(cleanQuery);
        const matchSubtitle = item.subtitle?.toLowerCase().includes(cleanQuery);
        const matchMethod = item.method?.toLowerCase().includes(cleanQuery);
        const matchPath = item.path?.toLowerCase().includes(cleanQuery);
        return matchTitle || matchSubtitle || matchMethod || matchPath;
      })
    : allItems.slice(0, 30); // show top 30 suggestions when empty

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation (Arrow Up, Arrow Down, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PUT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'PATCH':
        return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/40 backdrop-blur-md transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Mac Glassmorphic Modal Window */}
      <div
        className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-150 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Mac OS Window Header Buttons & Search Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-white/10 bg-white/[0.03]">
          {/* Traffic Lights (Mac style) */}
          <div className="flex items-center gap-2 mr-3.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors shadow-xs cursor-pointer border border-rose-600/30"
              aria-label="Close"
            />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/30" />
          </div>

          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search endpoints, HTTP methods, modules, or pages... (Type / or ⌘K)"
            className="w-full bg-transparent text-sm sm:text-base font-medium text-white placeholder:text-slate-500 outline-none border-none focus:ring-0"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 ml-2 px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[11px] font-mono text-slate-300">
            <span>ESC</span>
          </div>
        </div>

        {/* Results Container */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
              <p className="text-sm font-semibold text-slate-300">No matching results found</p>
              <p className="text-xs text-slate-500 mt-1">Try searching for GET, POST, auth, health, or module names</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.title}-${index}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3.5 py-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition-all duration-100 ${
                    isSelected
                      ? 'bg-indigo-600/30 border border-indigo-500/40 text-white backdrop-blur-sm'
                      : 'hover:bg-white/[0.04] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Item Type / Method Indicator */}
                    {item.type === 'endpoint' && item.method ? (
                      <span
                        className={`font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${getMethodBadgeClass(
                          item.method
                        )}`}
                      >
                        {item.method}
                      </span>
                    ) : item.type === 'module' ? (
                      <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <FileCode className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate text-white">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Return Key Enter Hint on Selection */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected ? (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-200 bg-indigo-500/20 px-2 py-1 rounded-md border border-indigo-400/30">
                        <span>Select</span>
                        <CornerDownLeft className="w-3 h-3" />
                      </div>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-600 opacity-40 group-hover:opacity-100" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mac OS Footer Navigation Controls */}
        <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300">
                ↓
              </kbd>
              <span className="ml-0.5">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300">
                ↵
              </kbd>
              <span className="ml-0.5">to open / inspect</span>
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="font-semibold text-slate-400">Spotlight API Search</span>
          </div>
        </div>
      </div>
    </div>
  );
};
