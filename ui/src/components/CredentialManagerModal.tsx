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
  Plus,
  ArrowRight,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal } from './Modal';

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

/* ---------- small field input ---------- */
const Field: React.FC<{
  label: string;
  Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, Icon, right, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label
        className="inline-flex items-center gap-1.5 text-[12px] font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />}
        {label}
      </label>
      {right}
    </div>
    {children}
  </div>
);

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ value, onChange, placeholder, mono = true }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full h-9 px-3 rounded-[var(--r-sm)] outline-none transition-all ${
      mono ? 'mono' : ''
    } text-[12.5px]`}
    style={{
      background: 'var(--bg-canvas)',
      border: '1px solid var(--border-default)',
      color: 'var(--text-primary)',
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = 'var(--border-focus)';
      e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)';
    }}
    onBlur={(e) => {
      e.currentTarget.style.borderColor = 'var(--border-default)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  />
);

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
      if (k && v) customHeadersMap[k] = v;
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
    }, 800);
  };

  const hasAnyCreds = !!(
    accessToken ||
    refreshToken ||
    tenantId ||
    entityId ||
    customHeaders.some((h) => h.key && h.value)
  );

  const CopyBtn: React.FC<{ value: string; keyName: string }> = ({ value, keyName }) => {
    if (!value) return null;
    const isCopied = copiedKey === keyName;
    return (
      <button
        type="button"
        onClick={() => handleCopy(value, keyName)}
        className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        {isCopied ? <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success-500)' }} /> : <Copy className="w-3 h-3" />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Credentials & headers"
      subtitle="Auto-captured tokens, tenant parameters, and custom request headers"
      widthClass="max-w-xl"
    >
      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-5 pt-3 pb-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('standard')}
          className="pb-2.5 px-2 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: activeTab === 'standard' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'standard' ? '2px solid var(--accent-500)' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          <Shield className="w-3.5 h-3.5" />
          Core tokens
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('custom')}
          className="pb-2.5 px-2 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
          style={{
            color: activeTab === 'custom' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === 'custom' ? '2px solid var(--accent-500)' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          <Sliders className="w-3.5 h-3.5" />
          Custom headers
          {customHeaders.length > 0 && (
            <span
              className="h-4 px-1.5 rounded mono text-[10px] font-semibold"
              style={{
                background: 'var(--accent-muted)',
                color: 'var(--accent-500)',
              }}
            >
              {customHeaders.length}
            </span>
          )}
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
        {activeTab === 'standard' ? (
          <>
            {/* Auto-capture hint */}
            <div
              className="flex items-start gap-2.5 p-3 rounded-[var(--r-sm)] text-[12px] leading-relaxed"
              style={{
                background: 'var(--accent-muted)',
                border: '1px solid color-mix(in srgb, var(--accent-500) 22%, transparent)',
                color: 'var(--text-secondary)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--accent-500)' }} />
              <div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Auto-capture is active.</span>{' '}
                Testing a login or token endpoint automatically saves the returned tokens and tenant IDs here,
                then injects them into every subsequent sandbox call.
              </div>
            </div>

            <Field
              label="Access token (Authorization: Bearer)"
              Icon={KeyRound}
              right={<CopyBtn value={accessToken} keyName="access" />}
            >
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="eyJh… (auto-injected into Authorization: Bearer <token>)"
                rows={2}
                className="w-full p-3 rounded-[var(--r-sm)] mono text-[12px] resize-none outline-none transition-all"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </Field>

            <Field
              label="Refresh token (X-Refresh-Token)"
              Icon={RefreshCw}
              right={<CopyBtn value={refreshToken} keyName="refresh" />}
            >
              <TextInput
                value={refreshToken}
                onChange={setRefreshToken}
                placeholder="e.g. refresh_token_xyz…"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tenant ID (X-Tenant-ID)" Icon={Building2}>
                <TextInput
                  value={tenantId}
                  onChange={setTenantId}
                  placeholder="e.g. tenant_98765"
                />
              </Field>
              <Field label="Entity ID (X-Entity-ID)" Icon={UserCircle}>
                <TextInput
                  value={entityId}
                  onChange={setEntityId}
                  placeholder="e.g. ent_12345"
                />
              </Field>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Custom request headers
                </h3>
                <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  Inject arbitrary headers like X-Account-Key or X-App-Client into every sandbox request.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomHeader}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors shrink-0"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {customHeaders.length === 0 ? (
              <button
                type="button"
                onClick={handleAddCustomHeader}
                className="w-full py-8 rounded-[var(--r-md)] text-center transition-all"
                style={{
                  border: '1.5px dashed var(--border-strong)',
                  color: 'var(--text-tertiary)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-500)';
                  e.currentTarget.style.color = 'var(--accent-500)';
                  e.currentTarget.style.background = 'var(--accent-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Plus className="w-4 h-4 mx-auto mb-2" />
                <div className="text-[12px] font-medium">Add your first custom header</div>
              </button>
            ) : (
              <div className="space-y-2">
                {customHeaders.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Header name"
                      value={item.key}
                      onChange={(e) => handleCustomHeaderChange(index, 'key', e.target.value)}
                      className="flex-1 h-9 px-3 rounded-[var(--r-sm)] mono text-[12px] outline-none transition-all"
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-focus)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                      }}
                    />
                    <ArrowRight
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={item.value}
                      onChange={(e) => handleCustomHeaderChange(index, 'value', e.target.value)}
                      className="flex-1 h-9 px-3 rounded-[var(--r-sm)] mono text-[12px] outline-none transition-all"
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-focus)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomHeader(index)}
                      className="grid place-items-center w-8 h-8 rounded-[var(--r-sm)] transition-colors shrink-0"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-500) 8%, transparent)';
                        e.currentTarget.style.color = 'var(--danger-500)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-tertiary)';
                      }}
                      aria-label="Remove header"
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
          <div className="text-[11px] text-right" style={{ color: 'var(--text-tertiary)' }}>
            Last synced {credentials.updatedAt}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4 mt-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
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
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-medium transition-all disabled:opacity-40"
            style={{
              background: 'transparent',
              border: '1px solid color-mix(in srgb, var(--danger-500) 30%, transparent)',
              color: 'var(--danger-500)',
            }}
            onMouseEnter={(e) => {
              if (hasAnyCreds) {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-500) 8%, transparent)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all"
              style={{
                background: justSaved ? 'var(--success-500)' : 'var(--accent-500)',
                color: 'var(--text-inverse)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={(e) => {
                if (!justSaved) e.currentTarget.style.background = 'var(--accent-400)';
              }}
              onMouseLeave={(e) => {
                if (!justSaved) e.currentTarget.style.background = 'var(--accent-500)';
              }}
            >
              {justSaved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                'Apply & save'
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};