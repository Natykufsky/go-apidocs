import React, { useState } from 'react';

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
  activeModule: string;
  onModuleChange: (mod: string) => void;
  availableModules: string[];
  qaMode: boolean;
  onToggleQAMode: () => void;
  onOpenQAReport: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  activeModule,
  onModuleChange,
  availableModules,
  qaMode,
  onToggleQAMode,
  onOpenQAReport,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
            {config.icon || '⚡'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none group-hover:text-indigo-400 transition-colors">
              {config.title || 'API Documentation'}
            </h1>
            <p className="text-[11px] font-medium text-slate-400 leading-none mt-1">
              {config.subtitle || 'Developer Reference & QA Suite'}
            </p>
          </div>
        </a>

        {/* Center / Right Actions (Desktop) */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Module Selector */}
          {availableModules.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-400">📦 Scope:</span>
              <select
                value={activeModule}
                onChange={(e) => onModuleChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">🌟 All Endpoints</option>
                {availableModules.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* QA Toggle */}
          <button
            onClick={onToggleQAMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              qaMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <span>🧪 QA Mode:</span>
            <span className={qaMode ? 'text-emerald-400' : 'text-slate-500'}>
              {qaMode ? 'Active' : 'Off'}
            </span>
          </button>

          {/* QA Report */}
          <button
            onClick={onOpenQAReport}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <span>📋 QA Report</span>
          </button>

          {/* Custom Nav Links from JSON */}
          {config.nav_items?.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                item.is_button
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-800'
              }`}
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </a>
          ))}

          {/* Logout button */}
          <a
            href="/docs/logout"
            title="Lock Session"
            className="p-2 text-red-400/80 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-all text-xs flex items-center"
          >
            🔒
          </a>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 flex flex-col gap-3">
          {availableModules.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Filter Scope:</label>
              <select
                value={activeModule}
                onChange={(e) => {
                  onModuleChange(e.target.value);
                  setMobileOpen(false);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-white"
              >
                <option value="all">🌟 All Endpoints</option>
                {availableModules.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onToggleQAMode();
                setMobileOpen(false);
              }}
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center"
            >
              🧪 QA: {qaMode ? 'Active' : 'Off'}
            </button>
            <button
              onClick={() => {
                onOpenQAReport();
                setMobileOpen(false);
              }}
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center"
            >
              📋 Export Report
            </button>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-2">
            {config.nav_items?.map((item, idx) => (
              <a
                key={idx}
                href={item.url}
                className="py-2 px-3 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-900 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
