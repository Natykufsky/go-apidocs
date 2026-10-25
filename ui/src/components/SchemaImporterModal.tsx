import React, { useState, useRef } from 'react';
import { load as loadYaml } from 'js-yaml';
import {
  Upload,
  Link as LinkIcon,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Folder,
  X,
} from 'lucide-react';
import { Modal } from './Modal';
import { Workspace } from './WorkspaceSwitcher';

interface SchemaImporterModalProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  maxSpecBytes?: number;
  remoteFetchEnabled?: boolean;
  onClose: () => void;
  onImportSuccess: (workspaceId: string, serviceId: string) => void;
}

interface PreflightSummary {
  title: string;
  version: string;
  description?: string;
  openapiVersion: string;
  pathCount: number;
  totalOps: number;
  methods: Record<string, number>;
  tags: string[];
  rawText: string;
}

const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const methodTone = (m: string): { fg: string; bg: string; bd: string } => {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    GET: {
      fg: 'var(--info-500)',
      bg: 'color-mix(in srgb, var(--info-500) 12%, transparent)',
      bd: 'color-mix(in srgb, var(--info-500) 24%, transparent)',
    },
    POST: {
      fg: 'var(--success-500)',
      bg: 'color-mix(in srgb, var(--success-500) 12%, transparent)',
      bd: 'color-mix(in srgb, var(--success-500) 24%, transparent)',
    },
    PUT: {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 12%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 24%, transparent)',
    },
    PATCH: {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 12%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 24%, transparent)',
    },
    DELETE: {
      fg: 'var(--danger-500)',
      bg: 'color-mix(in srgb, var(--danger-500) 12%, transparent)',
      bd: 'color-mix(in srgb, var(--danger-500) 24%, transparent)',
    },
  };
  return (
    map[m] || {
      fg: 'var(--text-secondary)',
      bg: 'var(--bg-overlay)',
      bd: 'var(--border-subtle)',
    }
  );
};

export const SchemaImporterModal: React.FC<SchemaImporterModalProps> = ({
  workspaces,
  activeWorkspaceId,
  maxSpecBytes = 5 * 1024 * 1024,
  remoteFetchEnabled = false,
  onClose,
  onImportSuccess,
}) => {
  const [sourceType, setSourceType] = useState<'upload' | 'url' | 'paste'>('upload');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>(
    activeWorkspaceId || workspaces[0]?.id || 'default',
  );
  const [urlInput, setUrlInput] = useState<string>('');
  const [pasteInput, setPasteInput] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [serviceTitle, setServiceTitle] = useState<string>('');
  const [preflight, setPreflight] = useState<PreflightSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseRawSpec = (rawText: string, filename?: string) => {
    setError(null);
    try {
      const trimmed = rawText.trim();
      if (!trimmed) {
        setPreflight(null);
        return;
      }

      if (trimmed.startsWith('{')) {
        const obj = JSON.parse(trimmed);
        const openapiVer = obj.openapi || obj.swagger;
        if (!openapiVer) throw new Error("Missing 'openapi' or 'swagger' version in specification");
        if (!obj.paths || typeof obj.paths !== 'object') {
          throw new Error("Specification must contain a valid 'paths' object");
        }

        const methods: Record<string, number> = {};
        const tagSet = new Set<string>();
        let totalOps = 0;

        for (const p in obj.paths) {
          const item = obj.paths[p];
          if (item && typeof item === 'object') {
            for (const m in item) {
              const upperM = m.toUpperCase();
              if (METHOD_ORDER.includes(upperM)) {
                totalOps++;
                methods[upperM] = (methods[upperM] || 0) + 1;
                const op = item[m];
                if (op && Array.isArray(op.tags)) op.tags.forEach((t: string) => tagSet.add(t));
              }
            }
          }
        }

        const title = obj.info?.title || filename || 'Imported API Spec';
        const version = obj.info?.version || '1.0.0';

        setPreflight({
          title,
          version,
          description: obj.info?.description,
          openapiVersion: openapiVer,
          pathCount: Object.keys(obj.paths).length,
          totalOps,
          methods,
          tags: Array.from(tagSet),
          rawText,
        });

        if (!serviceTitle) setServiceTitle(title);
        if (!serviceId) {
          setServiceId(
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `api-${Date.now()}`,
          );
        }
      } else {
        const obj = loadYaml(trimmed) as any;
        if (!obj || typeof obj !== 'object') {
          throw new Error('YAML document did not parse into a specification object');
        }
        const openapiVer = obj.openapi || obj.swagger;
        if (!openapiVer) throw new Error("Missing 'openapi' or 'swagger' version in YAML specification");
        if (!obj.paths || typeof obj.paths !== 'object') {
          throw new Error("YAML specification must contain a valid 'paths' object");
        }

        const methods: Record<string, number> = {};
        const tagSet = new Set<string>();
        let totalOps = 0;

        for (const p in obj.paths) {
          const item = obj.paths[p];
          if (item && typeof item === 'object') {
            for (const m in item) {
              const upperM = m.toUpperCase();
              if (METHOD_ORDER.includes(upperM)) {
                totalOps++;
                methods[upperM] = (methods[upperM] || 0) + 1;
                const op = item[m];
                if (op && Array.isArray(op.tags)) op.tags.forEach((t: string) => tagSet.add(t));
              }
            }
          }
        }

        const title = obj.info?.title || filename || 'Imported YAML API';
        const version = obj.info?.version || '1.0.0';

        setPreflight({
          title,
          version,
          description: obj.info?.description,
          openapiVersion: `${openapiVer} (YAML)`,
          pathCount: Object.keys(obj.paths).length,
          totalOps,
          methods,
          tags: Array.from(tagSet),
          rawText,
        });
        if (!serviceTitle) setServiceTitle(title);
        if (!serviceId) {
          setServiceId(
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `api-${Date.now()}`,
          );
        }
      }
    } catch (err: any) {
      setPreflight(null);
      setError(err.message || 'Failed to parse API specification');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSpecBytes) {
      setError(
        `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the ${(maxSpecBytes / 1024 / 1024).toFixed(1)}MB limit`,
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      parseRawSpec(content, file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const handleSaveAndLaunch = async () => {
    if (!preflight) {
      setError('Please select or paste a valid API specification first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetWs = targetWorkspaceId || 'default';
      const targetSvc = serviceId || 'api-' + Date.now();

      const response = await fetch(
        `/docs/workspaces/import?ws=${encodeURIComponent(targetWs)}&svc=${encodeURIComponent(targetSvc)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Apidocs-CSRF': '1' },
          body: preflight.rawText,
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errData.error || `Server returned status ${response.status}`);
      }

      onImportSuccess(targetWs, targetSvc);
    } catch (err: any) {
      setError(err.message || 'Failed to save specification');
      setLoading(false);
    }
  };

  const sourceTab = (id: typeof sourceType, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = sourceType === id;
    return (
      <button
        type="button"
        onClick={() => setSourceType(id)}
        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-all"
        style={
          active
            ? {
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-xs)',
              }
            : {
                background: 'transparent',
                color: 'var(--text-tertiary)',
              }
        }
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Import API specification"
      subtitle="Register an OpenAPI 3.x or Swagger 2.0 definition into your workspace"
      widthClass="max-w-2xl"
    >
      <div className="p-5 space-y-5">
        {/* Source tabs */}
        <div>
          <div
            className="text-[10.5px] font-semibold uppercase mb-2"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
          >
            1 · Specification source
          </div>
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-[var(--r-sm)]"
            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
          >
            {sourceTab('upload', 'Upload', Upload)}
            {sourceTab('paste', 'Paste', FileCode)}
            {sourceTab('url', 'URL', LinkIcon)}
          </div>
        </div>

        {/* Upload zone */}
        {sourceType === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-[var(--r-md)] p-8 text-center cursor-pointer transition-all"
            style={{
              border: '1.5px dashed var(--border-strong)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-500)';
              e.currentTarget.style.background = 'var(--accent-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload
              className="w-6 h-6 mx-auto mb-2.5"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
              Choose a file or drag it here
            </div>
            <div className="text-[11.5px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              OpenAPI 3.x · Swagger 2.0 · .json · .yaml · max {Math.round(maxSpecBytes / 1024 / 1024)}MB
            </div>
          </div>
        )}

        {/* Paste */}
        {sourceType === 'paste' && (
          <textarea
            rows={6}
            placeholder="Paste your OpenAPI JSON or YAML specification…"
            value={pasteInput}
            onChange={(e) => {
              setPasteInput(e.target.value);
              parseRawSpec(e.target.value);
            }}
            className="w-full p-3 rounded-[var(--r-md)] mono text-[12px] outline-none transition-all resize-none"
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
        )}

        {/* URL */}
        {sourceType === 'url' && (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com/api/swagger.json"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
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
                disabled={!urlInput || loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    const res = await fetch(urlInput);
                    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
                    const text = await res.text();
                    parseRawSpec(text);
                  } catch (err: any) {
                    setError(err.message || 'Failed to fetch remote URL');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="h-9 px-3.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'var(--accent-500)',
                  color: 'var(--text-inverse)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                {loading ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {!remoteFetchEnabled && (
              <div
                className="flex items-start gap-2 p-2.5 rounded-[var(--r-sm)] text-[11.5px]"
                style={{
                  background: 'color-mix(in srgb, var(--warning-500) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--warning-500) 24%, transparent)',
                  color: 'var(--warning-500)',
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Server-side remote fetch is disabled by policy — the browser will fetch directly.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2 p-3 rounded-[var(--r-sm)] text-[12px]"
            style={{
              background: 'color-mix(in srgb, var(--danger-500) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--danger-500) 24%, transparent)',
              color: 'var(--danger-500)',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Preflight summary */}
        {preflight && (
          <div
            className="rounded-[var(--r-md)] p-4 space-y-3"
            style={{
              background: 'color-mix(in srgb, var(--success-500) 5%, var(--bg-surface))',
              border: '1px solid color-mix(in srgb, var(--success-500) 22%, transparent)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--success-500)' }}
                />
                <span
                  className="text-[12.5px] font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Valid specification detected
                </span>
              </div>
              <span
                className="shrink-0 mono text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: 'color-mix(in srgb, var(--success-500) 14%, transparent)',
                  color: 'var(--success-500)',
                  border: '1px solid color-mix(in srgb, var(--success-500) 28%, transparent)',
                }}
              >
                {preflight.openapiVersion}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Paths', value: preflight.pathCount },
                { label: 'Operations', value: preflight.totalOps },
                { label: 'Tags', value: preflight.tags.length },
              ].map((s) => (
                <div
                  key={s.label}
                  className="p-2.5 rounded-[var(--r-sm)] text-center"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    className="mono text-[15px] font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="text-[10.5px] uppercase font-medium mt-0.5"
                    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(preflight.methods).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {METHOD_ORDER.filter((m) => preflight.methods[m]).map((m) => {
                  const t = methodTone(m);
                  return (
                    <span
                      key={m}
                      className="mono text-[10.5px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
                    >
                      {m} · {preflight.methods[m]}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Destination */}
        <div>
          <div
            className="text-[10.5px] font-semibold uppercase mb-2"
            style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
          >
            2 · Destination
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11.5px] font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Workspace
              </label>
              <div className="relative">
                <Folder
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <select
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="w-full h-9 pl-8 pr-2 rounded-[var(--r-sm)] text-[12.5px] outline-none cursor-pointer appearance-none"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label
                className="block text-[11.5px] font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Service title
              </label>
              <input
                type="text"
                value={serviceTitle}
                onChange={(e) => setServiceTitle(e.target.value)}
                placeholder="e.g. Invoicing API"
                className="w-full h-9 px-3 rounded-[var(--r-sm)] text-[12.5px] outline-none transition-all"
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
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-canvas)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!preflight || loading}
          onClick={handleSaveAndLaunch}
          className="h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--accent-500)',
            color: 'var(--text-inverse)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={(e) => {
            if (preflight && !loading) e.currentTarget.style.background = 'var(--accent-400)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-500)';
          }}
        >
          {loading ? (
            <>Saving…</>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Save &amp; open sandbox
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};