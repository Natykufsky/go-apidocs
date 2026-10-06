import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Check, Plus, Upload, Box, ShieldCheck } from 'lucide-react';

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
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  activeServiceId,
  writesEnabled,
  onSelectService,
  onOpenImporter,
  onOpenSecurityAudit,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          w.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((w) => w.services.length > 0 || w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all text-xs font-semibold shadow-2xs group cursor-pointer"
        title="Switch Workspace or API Service"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm shrink-0">{activeWs?.icon || '📁'}</span>
          <div className="flex flex-col text-left leading-tight min-w-0 flex-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate uppercase tracking-wider">
              {activeWs?.name || 'Workspace'}
            </span>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1">
              {activeSvc?.title || 'Main API'}
            </span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/90 shadow-2xl z-[100] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header & Search */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workspaces & APIs
              </span>
              {onOpenImporter && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenImporter();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Workspace</span>
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Search workspaces & services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Workspaces & Services List */}
          <div className="max-h-64 overflow-y-auto p-2 space-y-3">
            {filteredWorkspaces.map((ws) => (
              <div key={ws.id} className="space-y-1">
                <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span>{ws.icon || '📁'}</span>
                  <span className="truncate">{ws.name}</span>
                </div>
                <div className="space-y-0.5">
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
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                          <span className="text-xs shrink-0">{svc.icon || '⚡'}</span>
                          <div className="truncate min-w-0 flex-1">
                            <div className="truncate text-slate-900 dark:text-slate-100 font-semibold">{svc.title}</div>
                            {svc.version && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                v{svc.version}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredWorkspaces.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching services found</div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center gap-2">
            {onOpenImporter && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenImporter();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Workspace</span>
              </button>
            )}
            {onOpenSecurityAudit && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSecurityAudit();
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                title="Run Security Audit"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Audit</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
