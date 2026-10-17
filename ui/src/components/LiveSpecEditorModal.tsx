import React, { useState, useEffect } from 'react';
import { X, Code2, Save, RotateCcw, AlertTriangle, CheckCircle2, History, Eye, Terminal } from 'lucide-react';

interface LiveSpecEditorModalProps {
  isOpen: boolean;
  workspaceId: string;
  serviceId: string;
  serviceTitle: string;
  onClose: () => void;
  onSpecSaved: () => void;
}

export const LiveSpecEditorModal: React.FC<LiveSpecEditorModalProps> = ({
  isOpen,
  workspaceId,
  serviceId,
  serviceTitle,
  onClose,
  onSpecSaved,
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [parsedPreview, setParsedPreview] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    fetch(`/docs/workspaces/spec/raw?ws=${encodeURIComponent(workspaceId)}&svc=${encodeURIComponent(serviceId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load raw spec');
        return res.text();
      })
      .then((text) => {
        if (!mounted) return;
        // Format if valid JSON
        let formatted = text;
        try {
          const parsed = JSON.parse(text);
          formatted = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // Keep as is (could be YAML)
        }
        setContent(formatted);
        setOriginalContent(formatted);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Error loading spec');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, workspaceId, serviceId]);

  if (!isOpen) return null;

  const handleValidate = () => {
    setError(null);
    try {
      const parsed = JSON.parse(content);
      if (!parsed.openapi && !parsed.swagger) {
        throw new Error('Missing "openapi" or "swagger" version declaration at root level.');
      }
      if (!parsed.info || !parsed.info.title) {
        throw new Error('Missing "info.title" property in spec.');
      }
      setParsedPreview(parsed);
      return true;
    } catch (err: any) {
      setError(`Spec Validation Error: ${err.message}`);
      return false;
    }
  };

  const handleSave = async () => {
    if (!handleValidate()) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/docs/workspaces/spec', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Apidocs-CSRF': '1',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          service_id: serviceId,
          content: content,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || (data && !data.success)) {
        throw new Error((data && data.error) || 'Failed to save OpenAPI spec');
      }

      setOriginalContent(content);
      setSuccessMsg('OpenAPI spec updated and committed successfully!');
      onSpecSaved();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving OpenAPI spec');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-[#0c111d] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Live OpenAPI Spec Editor</h2>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Service: <span className="font-semibold text-slate-700 dark:text-slate-300">{serviceTitle}</span> ({serviceId})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                JSON/YAML Editor
              </button>
              <button
                type="button"
                onClick={() => {
                  handleValidate();
                  setActiveTab('preview');
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Structure Preview
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Editor Body */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-semibold">
              Loading OpenAPI schema...
            </div>
          ) : activeTab === 'editor' ? (
            <div className="flex-1 relative rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-mono text-xs">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Live Schema Source
                </span>
                <span>{content.split('\n').length} lines</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 bg-transparent text-emerald-300 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-0 selection:bg-cyan-500/30"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-4">
              {parsedPreview ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{parsedPreview.info?.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{parsedPreview.info?.description}</p>
                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400">
                      <span>Version: <strong>{parsedPreview.info?.version}</strong></span>
                      <span>Spec: <strong>{parsedPreview.openapi || parsedPreview.swagger}</strong></span>
                      <span>Endpoints: <strong>{Object.keys(parsedPreview.paths || {}).length} paths</strong></span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Endpoints Defined ({Object.keys(parsedPreview.paths || {}).length})
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(parsedPreview.paths || {}).map(([path, methods]: any) => (
                        <div
                          key={path}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between"
                        >
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{path}</span>
                          <div className="flex items-center gap-1">
                            {Object.keys(methods || {}).map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-slate-400">Switch to editor to validate and view structure.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <History className="w-4 h-4 text-slate-400" />
            <span>Automatic version backup preserved upon save.</span>
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={() => setContent(originalContent)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert Changes</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save & Publish Live'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
