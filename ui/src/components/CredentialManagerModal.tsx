import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  Trash2,
  CheckCircle2,
  Copy,
  Building2,
  UserCircle,
  RefreshCw,
  X,
  Plus,
  ArrowRight,
  Sliders,
  Sparkles
} from 'lucide-react';

export interface CustomHeaderMapping {
  headerName: string;
  responseKey: string;
  value?: string;
}

export interface StoredCredentials {
  accessToken?: string;
  refreshToken?: string;
  tenantId?: string;
  entityId?: string;
  customHeaders?: Record<string, string>;
  updatedAt?: string;
}

interface CredentialManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: StoredCredentials;
  onSave: (creds: StoredCredentials) => void;
  onClear: () => void;
}

export const CredentialManagerModal: React.FC<CredentialManagerModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onSave,
  onClear,
}) => {
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccessToken(credentials.accessToken || '');
      setRefreshToken(credentials.refreshToken || '');
      setTenantId(credentials.tenantId || '');
      setEntityId(credentials.entityId || '');

      const customArr: Array<{ key: string; value: string }> = [];
      if (credentials.customHeaders) {
        Object.entries(credentials.customHeaders).forEach(([k, v]) => {
          customArr.push({ key: k, value: v });
        });
      }
      setCustomHeaders(customArr);
      setJustSaved(false);
    }
  }, [isOpen, credentials]);

  if (!isOpen) return null;

  const handleCopy = (text: string, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddCustomHeader = () => {
    setCustomHeaders((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveCustomHeader = (index: number) => {
    setCustomHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCustomHeaderChange = (index: number, field: 'key' | 'value', val: string) => {
    setCustomHeaders((prev) => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customHeadersMap: Record<string, string> = {};
    customHeaders.forEach((item) => {
      const k = item.key.trim();
      const v = item.value.trim();
      if (k && v) {
        customHeadersMap[k] = v;
      }
    });

    onSave({
      accessToken: accessToken.trim(),
      refreshToken: refreshToken.trim(),
      tenantId: tenantId.trim(),
      entityId: entityId.trim(),
      customHeaders: customHeadersMap,
      updatedAt: new Date().toLocaleTimeString(),
    });

    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      onClose();
    }, 1000);
  };

  const hasAnyCreds = !!(
    accessToken ||
    refreshToken ||
    tenantId ||
    entityId ||
    customHeaders.some((h) => h.key && h.value)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-600/20">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Sandbox Credentials & Header Mapper</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Auto-captured tokens, tenant parameters, and custom request headers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'standard'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Core Tokens & Tenancy</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'custom'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Custom Header Mappings</span>
            {customHeaders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-extrabold">
                {customHeaders.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'standard' ? (
            <>
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Auto-Capture Active:</span> When you test login/token endpoints,
                  any access token or tenant ID returned is automatically saved here and injected into subsequent API calls.
                </div>
              </div>

              {/* Access Token */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    Access Token / Bearer Token (`Authorization`)
                  </label>
                  {accessToken && (
                    <button
                      type="button"
                      onClick={() => handleCopy(accessToken, 'access')}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'access' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'access' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="eyJh... (Auto-injected into Authorization: Bearer <token>)"
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              {/* Refresh Token */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    Refresh Token (`X-Refresh-Token`)
                  </label>
                  {refreshToken && (
                    <button
                      type="button"
                      onClick={() => handleCopy(refreshToken, 'refresh')}
                      className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'refresh' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'refresh' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="e.g. refresh_token_xyz..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Tenant ID & Entity ID (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    Tenant ID (`X-Tenant-ID`)
                  </label>
                  <input
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="e.g. tenant_98765"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <UserCircle className="w-3.5 h-3.5 text-slate-500" />
                    Entity ID (`X-Entity-ID`)
                  </label>
                  <input
                    type="text"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder="e.g. ent_12345"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Custom Request Headers</h3>
                  <p className="text-[11px] text-slate-500">
                    Inject arbitrary headers like `X-Account-Key`, `X-App-Client`, etc. into every sandbox test.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomHeader}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 border border-emerald-200 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Header</span>
                </button>
              </div>

              {customHeaders.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 italic">No custom headers configured.</p>
                  <button
                    type="button"
                    onClick={handleAddCustomHeader}
                    className="mt-2 text-xs text-emerald-600 font-bold hover:underline"
                  >
                    + Add your first custom header
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {customHeaders.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Header Name (e.g. X-Org-ID)"
                        value={item.key}
                        onChange={(e) => handleCustomHeaderChange(index, 'key', e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                      />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Value (e.g. org_456)"
                        value={item.value}
                        onChange={(e) => handleCustomHeaderChange(index, 'value', e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomHeader(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {credentials.updatedAt && (
            <p className="text-[11px] text-slate-400 text-right">
              Last Synced: {credentials.updatedAt}
            </p>
          )}

          {/* Footer actions inside form */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={!hasAnyCreds}
              onClick={() => {
                if (window.confirm('Clear all stored sandbox credentials from local storage?')) {
                  onClear();
                  setAccessToken('');
                  setRefreshToken('');
                  setTenantId('');
                  setEntityId('');
                  setCustomHeaders([]);
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Credentials</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {justSaved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Apply & Save</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
