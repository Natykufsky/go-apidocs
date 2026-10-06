import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Palette,
  Shield,
  CreditCard,
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  Database,
  Sliders,
  Check,
} from 'lucide-react';

export interface TenantTheme {
  primary_color: string;
  accent_color: string;
  logo_url: string;
  custom_css: string;
  dark_mode: boolean;
}

export interface TenantLimits {
  max_workspaces: number;
  max_services: number;
  monthly_ai_calls: number;
  used_ai_calls: number;
  max_storage_mb: number;
  used_storage_mb: number;
  rate_limit_rpm: number;
  allowed_ai_providers: string[];
}

export interface TenantData {
  id: string;
  name: string;
  plan: string;
  api_key: string;
  status: string;
  billing_id?: string;
  limits: TenantLimits;
  theme: TenantTheme;
}

interface TenantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeSaved?: (theme: TenantTheme) => void;
}

const PRESET_THEMES = [
  { name: 'Emerald & Indigo', primary: '#10b981', accent: '#6366f1' },
  { name: 'Cyberpunk Violet', primary: '#8b5cf6', accent: '#ec4899' },
  { name: 'Ocean Blue', primary: '#0ea5e9', accent: '#3b82f6' },
  { name: 'Amber Gold', primary: '#f59e0b', accent: '#d97706' },
  { name: 'Ruby Crimson', primary: '#e11d48', accent: '#be123c' },
];

export const TenantSettingsModal: React.FC<TenantSettingsModalProps> = ({ isOpen, onClose, onThemeSaved }) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'quotas' | 'billing' | 'apikey'>('branding');
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [logoUrl, setLogoUrl] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/v1/saas/tenant')
      .then((res) => {
        if (!res.ok) throw new Error('Could not fetch tenant metadata');
        return res.json();
      })
      .then((data: TenantData) => {
        if (data) {
          setTenant(data);
          if (data.theme) {
            setPrimaryColor(data.theme.primary_color || '#10b981');
            setAccentColor(data.theme.accent_color || '#6366f1');
            setLogoUrl(data.theme.logo_url || '');
            setCustomCss(data.theme.custom_css || '');
            setDarkMode(!!data.theme.dark_mode);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveTheme = async () => {
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    const themePayload: TenantTheme = {
      primary_color: primaryColor,
      accent_color: accentColor,
      logo_url: logoUrl,
      custom_css: customCss,
      dark_mode: darkMode,
    };

    try {
      const res = await fetch('/api/v1/saas/tenant/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(themePayload),
      });

      if (!res.ok) {
        throw new Error('Failed to update tenant theme');
      }

      setSavedSuccess(true);
      if (onThemeSaved) onThemeSaved(themePayload);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving theme');
    } finally {
      setSaving(false);
    }
  };

  const calculateQuotaPercent = (used: number, max: number) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-md">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Tenant Settings & SaaS Hub</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 uppercase">
                  {tenant?.plan || 'Enterprise'} Plan
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Org: {tenant?.name || 'Default Organization'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'branding'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme & Branding</span>
          </button>

          <button
            onClick={() => setActiveTab('quotas')}
            className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'quotas'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Usage & Quotas</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Subscription & Invoices</span>
          </button>

          <button
            onClick={() => setActiveTab('apikey')}
            className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'apikey'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Tenant API Key</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Tenant theme saved successfully!</span>
            </div>
          )}

          {/* Tab 1: Theme & Branding */}
          {activeTab === 'branding' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Preset Color Themes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_THEMES.map((th) => (
                    <button
                      key={th.name}
                      onClick={() => {
                        setPrimaryColor(th.primary);
                        setAccentColor(th.accent);
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-left space-y-1.5 transition-all cursor-pointer bg-white"
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: th.primary }} />
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: th.accent }} />
                      </div>
                      <div className="text-[11px] font-bold text-slate-800 truncate">{th.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Primary Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-9 h-9 rounded-xl border border-slate-200 p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-9 h-9 rounded-xl border border-slate-200 p-0.5 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Custom Logo URL</label>
                <input
                  type="text"
                  placeholder="https://acme.org/brand/logo.svg"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Custom CSS Overrides</label>
                <textarea
                  rows={3}
                  placeholder=":root { --border-radius: 12px; }"
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveTheme}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Save Brand Customizations</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Quotas & Usage */}
          {activeTab === 'quotas' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700">Monthly AI Test Generation Calls</span>
                    <span className="font-mono text-emerald-600">
                      {tenant?.limits.used_ai_calls || 0} / {tenant?.limits.monthly_ai_calls || 2500} calls
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{
                        width: `${calculateQuotaPercent(
                          tenant?.limits.used_ai_calls || 0,
                          tenant?.limits.monthly_ai_calls || 2500
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700">Storage & Schema Cache</span>
                    <span className="font-mono text-indigo-600">
                      {tenant?.limits.used_storage_mb || 0} / {tenant?.limits.max_storage_mb || 10000} MB
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{
                        width: `${calculateQuotaPercent(
                          Number(tenant?.limits.used_storage_mb) || 0,
                          Number(tenant?.limits.max_storage_mb) || 10000
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold">MAX WORKSPACES</span>
                    <strong className="text-sm text-slate-900">{tenant?.limits.max_workspaces || 50}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold">MAX SERVICES</span>
                    <strong className="text-sm text-slate-900">{tenant?.limits.max_services || 200}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold">RATE LIMIT (RPM)</span>
                    <strong className="text-sm text-slate-900">{tenant?.limits.rate_limit_rpm || 1000} req/m</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Billing */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Current Subscription</h4>
                    <p className="text-[11px] text-slate-500">Tier: {tenant?.plan || 'Enterprise'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                  Customer ID: {tenant?.billing_id || 'cus_live_apidocs_enterprise'}
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer">
                    Manage Stripe Subscription
                  </button>
                  <button className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer">
                    Download Invoices
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: API Key */}
          {activeTab === 'apikey' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900">Live Organization API Key</h4>
                <p className="text-[11px] text-slate-500">
                  Use this key in the <code className="text-emerald-700">X-API-Key</code> or{' '}
                  <code className="text-emerald-700">Authorization: Bearer ak_...</code> header.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    readOnly
                    value={tenant?.api_key || 'ak_live_default_demo_key'}
                    className="flex-1 text-xs font-mono px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
                  />
                  <button
                    onClick={() => {
                      if (tenant?.api_key) navigator.clipboard.writeText(tenant.api_key);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Copy Key
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>Multi-tenant SaaS Isolation Engine &bull; Subdomain & API-Key Resolved</div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
