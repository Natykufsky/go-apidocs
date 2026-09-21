import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
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

export const SchemaImporterModal: React.FC<SchemaImporterModalProps> = ({
  workspaces,
  activeWorkspaceId,
  maxSpecBytes = 5 * 1024 * 1024,
  remoteFetchEnabled = false,
  onClose,
  onImportSuccess,
}) => {
  const [sourceType, setSourceType] = useState<'upload' | 'url' | 'paste'>('upload');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>(activeWorkspaceId || workspaces[0]?.id || 'default');
  const [urlInput, setUrlInput] = useState<string>('');
  const [pasteInput, setPasteInput] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [serviceTitle, setServiceTitle] = useState<string>('');
  const [preflight, setPreflight] = useState<PreflightSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side pre-flight parser for JSON
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
        if (!openapiVer) {
          throw new Error("Missing 'openapi' or 'swagger' version in specification");
        }
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
              if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(upperM)) {
                totalOps++;
                methods[upperM] = (methods[upperM] || 0) + 1;
                const op = item[m];
                if (op && Array.isArray(op.tags)) {
                  op.tags.forEach((t: string) => tagSet.add(t));
                }
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
              .replace(/^-|-$/g, '') || `api-${Date.now()}`
          );
        }
      } else {
        // Basic YAML heuristic preview
        if (!trimmed.includes('openapi:') && !trimmed.includes('swagger:')) {
          throw new Error('YAML document must include openapi: or swagger: tag');
        }
        const titleMatch = trimmed.match(/title:\s*["']?([^"'\n]+)/i);
        const title = titleMatch ? titleMatch[1].trim() : filename || 'Imported YAML API';
        setPreflight({
          title,
          version: '1.0.0',
          openapiVersion: '3.0.x (YAML)',
          pathCount: 1,
          totalOps: 1,
          methods: { GET: 1 },
          tags: ['General'],
          rawText,
        });
        if (!serviceTitle) setServiceTitle(title);
        if (!serviceId) {
          setServiceId(
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `api-${Date.now()}`
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
      setError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of ${(maxSpecBytes / 1024 / 1024).toFixed(1)}MB`);
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

  const handleSaveAndLaunch = async (launchSwagger: boolean) => {
    if (!preflight) {
      setError('Please select or paste a valid API specification first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const targetWs = targetWorkspaceId || 'default';
      const targetSvc = serviceId || 'api-' + Date.now();

      const response = await fetch(`/docs/workspaces/import?ws=${encodeURIComponent(targetWs)}&svc=${encodeURIComponent(targetSvc)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Apidocs-CSRF': '1',
        },
        body: preflight.rawText,
      });

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-base shadow-md shadow-indigo-600/20">
              📥
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">Import API Specification</h3>
              <p className="text-xs text-slate-600">Register new OpenAPI/Swagger definitions into your workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Source Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Specification Source
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setSourceType('upload')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sourceType === 'upload' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('paste')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sourceType === 'paste' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Paste JSON/YAML</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType('url')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  sourceType === 'url' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Remote URL</span>
              </button>
            </div>
          </div>

          {/* Source Input Panels */}
          {sourceType === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-slate-600 group-hover:text-indigo-600 mx-auto mb-2 transition-transform group-hover:scale-110" />
              <div className="text-xs font-bold text-slate-800">
                Click to browse or drop an OpenAPI file here
              </div>
              <div className="text-[11px] text-slate-600 mt-1">Supports OpenAPI 3.x / Swagger 2.0 (.json or .yaml)</div>
            </div>
          )}

          {sourceType === 'paste' && (
            <div>
              <textarea
                rows={5}
                placeholder="Paste your raw OpenAPI specification JSON or YAML here..."
                value={pasteInput}
                onChange={(e) => {
                  setPasteInput(e.target.value);
                  parseRawSpec(e.target.value);
                }}
                className="w-full p-3 rounded-2xl border border-slate-200 font-mono text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          {sourceType === 'url' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/api/swagger.json"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={!urlInput}
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Fetch
                </button>
              </div>
              {!remoteFetchEnabled && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Server-side remote fetch is disabled by policy. Browser will fetch directly.</span>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Pre-Flight Inspection Summary */}
          {preflight && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-indigo-950">Valid OpenAPI Specification Detected</span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-200/70 text-indigo-900 rounded-md">
                  {preflight.openapiVersion}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded-xl border border-indigo-100/80">
                  <div className="text-base font-extrabold text-indigo-950">{preflight.pathCount}</div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase">Endpoints</div>
                </div>
                <div className="p-2 bg-white rounded-xl border border-indigo-100/80">
                  <div className="text-base font-extrabold text-indigo-950">{preflight.totalOps}</div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase">Operations</div>
                </div>
                <div className="p-2 bg-white rounded-xl border border-indigo-100/80">
                  <div className="text-base font-extrabold text-indigo-950">{preflight.tags.length}</div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase">Tags</div>
                </div>
              </div>

              {/* Methods Breakdown */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(preflight.methods).map(([method, count]) => (
                  <span
                    key={method}
                    className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-white border border-slate-200 text-slate-800"
                  >
                    {method}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workspace Destination Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Workspace
              </label>
              <select
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.icon || '📁'} {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Service Title
              </label>
              <input
                type="text"
                value={serviceTitle}
                onChange={(e) => setServiceTitle(e.target.value)}
                placeholder="e.g. Invoicing API"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!preflight || loading}
            onClick={() => handleSaveAndLaunch(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save to Workspace'}
          </button>
          <button
            type="button"
            disabled={!preflight || loading}
            onClick={() => handleSaveAndLaunch(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Save & Launch Sandbox</span>
          </button>
        </div>
      </div>
    </div>
  );
};
