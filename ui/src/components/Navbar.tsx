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
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/20 text-white group-hover:scale-105 transition-transform">
            {config.icon || '⚡'}
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none group-hover:text-indigo-600 transition-colors">
              {config.title || 'API Documentation'}
            </h1>
            <p className="text-[11px] font-medium text-slate-500 leading-none mt-1">
              {config.subtitle || 'Developer Reference & QA Suite'}
            </p>
          </div>
        </a>

        {/* Center / Right Actions (Desktop) */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Module Selector */}
          {availableModules.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-semibold text-slate-600">📦 Scope:</span>
              <select
                value={activeModule}
                onChange={(e) => onModuleChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 outline-none cursor-pointer"
              >
                <option value="all" className="bg-white text-slate-900">🌟 All Endpoints</option>
                {availableModules.map((m) => (
                  <option key={m} value={m} className="bg-white text-slate-900">
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
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>🧪 QA Mode:</span>
            <span className={qaMode ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
              {qaMode ? 'Active' : 'Off'}
            </span>
          </button>

          {/* QA Report */}
          <button
            onClick={onOpenQAReport}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 transition-all"
          >
            <span>📋 QA Report</span>
          </button>

          {/* Nav Links */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            {config.nav_items?.map((item) => (
              <a
                key={item.label}
                href={item.url}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  item.is_button
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon && <span className="mr-1.5">{item.icon}</span>}
                {item.label}
                {item.badge && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 text-slate-700">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}

            {/* Logout button */}
            <a
              href="/docs/logout"
              title="Lock Session"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-all text-xs flex items-center ml-1"
            >
              🔒
            </a>
          </div>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900"
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-3 shadow-md">
          {availableModules.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-600">Filter Scope:</label>
              <select
                value={activeModule}
                onChange={(e) => {
                  onModuleChange(e.target.value);
                  setMobileOpen(false);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900"
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
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-300 text-emerald-700 text-center"
            >
              🧪 QA: {qaMode ? 'Active' : 'Off'}
            </button>
            <button
              onClick={() => {
                onOpenQAReport();
                setMobileOpen(false);
              }}
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-800 text-center"
            >
              📋 Report
            </button>
          </div>

          <div className="flex flex-col gap-1 pt-2 border-t border-slate-200">
            {config.nav_items?.map((item) => (
              <a
                key={item.label}
                href={item.url}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span>{item.icon}</span>}
                  {item.label}
                </span>
                {item.badge && (
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">
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
