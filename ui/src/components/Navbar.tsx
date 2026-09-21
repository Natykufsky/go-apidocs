import React, { useState } from 'react';
import { Menu, X, Lock, ExternalLink, Search, KeyRound } from 'lucide-react';

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
  onNavigate: (path: string) => void;
  onOpenSearch?: () => void;
  onOpenCredentials?: () => void;
  hasCredentials?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  currentPath,
  onNavigate,
  onOpenSearch,
  onOpenCredentials,
  hasCredentials = false,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const isCurrentActive = (url: string) => {
    if (url === '/' && (currentPath === '/' || currentPath === '' || currentPath === '/landing')) return true;
    if (url === '/docs' && (currentPath === '/docs' || currentPath === '/docs/index.html' || currentPath === '/swagger')) return true;
    if (url === '/guide' && currentPath.startsWith('/guide')) return true;
    if (url === '/dashboard' && (currentPath === '/dashboard' || currentPath === '/health')) return true;
    return currentPath === url;
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    if (item.external || item.url.endsWith('.json') || item.url.startsWith('http') || item.url.includes('/logout')) {
      return; // Native browser handling (e.g. file download, external URL, logout redirect)
    }
    e.preventDefault();
    onNavigate(item.url);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, { label: 'Home', url: '/' })}
          className="flex items-center gap-3 group cursor-pointer shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md shadow-indigo-600/20 text-white group-hover:scale-105 transition-transform">
            {config.icon || '⚡'}
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-none group-hover:text-indigo-600 transition-colors">
              {config.title || 'API Documentation'}
            </h1>
            <p className="text-[11px] font-medium text-slate-500 leading-none mt-1 hidden sm:block">
              {config.subtitle || 'Developer Reference & Sandbox Portal'}
            </p>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {config.nav_items?.map((item) => {
            const active = isCurrentActive(item.url);
            return (
              <a
                key={item.label}
                href={item.url}
                onClick={(e) => handleLinkClick(e, item)}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  item.is_button
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 ml-1'
                    : active
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 text-slate-700 font-bold">
                    {item.badge}
                  </span>
                )}
                {item.external && <ExternalLink className="w-3 h-3 text-slate-400" />}
              </a>
            );
          })}

          {/* Global Spotlight Search Trigger (Mac Style) */}
          <button
            onClick={onOpenSearch}
            title="Spotlight Search (Cmd+K / Ctrl+K)"
            className="flex items-center gap-2 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold hidden lg:inline">Search API...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500 shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Tokens / Auth Credentials Manager trigger in Navbar */}
          {onOpenCredentials && (
            <button
              onClick={onOpenCredentials}
              title="Manage API Tokens & Tenant Headers"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                hasCredentials
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                  : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200/80 text-slate-600'
              }`}
            >
              <KeyRound className={`w-3.5 h-3.5 ${hasCredentials ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="hidden lg:inline">{hasCredentials ? 'Credentials 🔐' : 'Auth'}</span>
            </button>
          )}

          {/* Font Size Selector */}
          <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 rounded-xl px-2 py-1 text-xs">
            <span className="text-slate-400 font-bold select-none text-[11px]">Aa</span>
            <select
              value={fontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              title="Adjust Portal Font Size"
              className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="90%">Small (90%)</option>
              <option value="100%">Default (100%)</option>
              <option value="110%">Medium (110%)</option>
              <option value="125%">Large (125%)</option>
            </select>
          </div>

          {/* Session Lock / Logout */}
          <a
            href="/docs/logout"
            title="Lock Session"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-all text-xs flex items-center ml-1"
          >
            <Lock className="w-3.5 h-3.5" />
          </a>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-2 shadow-xl animate-in slide-in-from-top-2">
          {/* Mobile Spotlight Search Button */}
          {onOpenSearch && (
            <button
              onClick={() => {
                setMobileOpen(false);
                onOpenSearch();
              }}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-between shadow-2xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600" />
                <span>Search API & Docs (Spotlight)</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Mobile Credentials Button */}
          {onOpenCredentials && (
            <button
              onClick={() => {
                setMobileOpen(false);
                onOpenCredentials();
              }}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-between shadow-2xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Sandbox Tokens & Tenant Credentials</span>
              </div>
              <span className="text-[11px] font-mono font-black text-indigo-600">
                {hasCredentials ? 'Active 🔐' : 'Configure'}
              </span>
            </button>
          )}

          {config.nav_items?.map((item) => {
            const active = isCurrentActive(item.url);
            return (
              <a
                key={item.label}
                href={item.url}
                onClick={(e) => handleLinkClick(e, item)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between transition-all ${
                  item.is_button
                    ? 'bg-indigo-600 text-white shadow-md'
                    : active
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon && <span className="text-base">{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}

          <div className="pt-2 border-t border-slate-100 mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Font Size</span>
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400 font-bold select-none text-[11px]">Aa</span>
              <select
                value={fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                className="bg-transparent text-slate-700 font-semibold outline-none cursor-pointer text-xs"
              >
                <option value="90%">Small (90%)</option>
                <option value="100%">Default (100%)</option>
                <option value="110%">Medium (110%)</option>
                <option value="125%">Large (125%)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Session Security</span>
            <a
              href="/docs/logout"
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Session
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
