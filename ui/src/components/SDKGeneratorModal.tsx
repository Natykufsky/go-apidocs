import React, { useState, useEffect } from 'react';
import { X, Code2, Download, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface SDKGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SDKGeneratorModal: React.FC<SDKGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [activeLang, setActiveLang] = useState<'typescript' | 'go' | 'python'>('typescript');
  const [sdkCode, setSdkCode] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch(`/docs/sdk?lang=${activeLang}`)
      .then((res) => res.json())
      .then((data) => {
        setSdkCode(data.code || '');
        setFilename(data.filename || `client.${activeLang === 'typescript' ? 'ts' : activeLang === 'go' ? 'go' : 'py'}`);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [isOpen, activeLang]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    window.open(`/docs/sdk?lang=${activeLang}&download=1`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Export Client SDK
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Zero-Dep
                </span>
              </h2>
              <p className="text-xs text-slate-400">Download production-ready typed API client packages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/60 border border-slate-800">
            {(['typescript', 'go', 'python'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  activeLang === lang
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {lang === 'typescript' ? 'TypeScript / Node' : lang === 'go' ? 'Go (Golang)' : 'Python 3'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {filename}</span>
            </button>
          </div>
        </div>

        {/* Code Preview Area */}
        <div className="flex-1 overflow-auto p-6 bg-slate-950/80 font-mono text-xs text-slate-300">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 animate-pulse">
              Synthesizing client SDK from OpenAPI schemas...
            </div>
          ) : (
            <pre className="whitespace-pre overflow-x-auto leading-relaxed selection:bg-indigo-600 selection:text-white">
              <code>{sdkCode}</code>
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Ready for import into React, Next.js, FastAPI, or Go microservices</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">{filename}</span>
        </div>
      </div>
    </div>
  );
};
