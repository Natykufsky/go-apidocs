import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
} from 'lucide-react';

export interface AITestCase {
  id: string;
  name: string;
  category: string;
  description: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
  request_body?: any;
  expected_status: number;
  expected_response_schema?: any;
  assertions: string[];
}

export interface AITestSuite {
  endpoint_key: string;
  summary: string;
  model_used: string;
  generated_at: string;
  test_cases: AITestCase[];
}

interface AITestGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  initialSuite?: AITestSuite;
  onLoadIntoSandbox?: (testCase: AITestCase) => void;
}

export const AITestGeneratorModal: React.FC<AITestGeneratorModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  initialSuite,
  onLoadIntoSandbox,
}) => {
  const [suite, setSuite] = useState<AITestSuite | null>(initialSuite || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTestCase, setSelectedTestCase] = useState<AITestCase | null>(null);

  if (!isOpen || !endpointKey) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/docs/qa/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          endpoint_key: endpointKey,
          custom_prompt: customPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI test cases');
      }

      setSuite(data.suite);
      if (data.suite?.test_cases?.length > 0) {
        setSelectedTestCase(data.suite.test_cases[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with NVIDIA DeepSeek NIM service');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = suite?.test_cases
    ? ['all', ...Array.from(new Set(suite.test_cases.map((t) => t.category)))]
    : ['all'];

  const filteredTests = suite?.test_cases.filter(
    (tc) => activeCategory === 'all' || tc.category === activeCategory
  ) || [];

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'happy path':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'boundary & edge':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'negative & error':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'security & abuse':
      case 'security & injection':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">AI Test Suite Generator</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  DeepSeek v4.1 Flash (NVIDIA NIM)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                Target: {endpointKey}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {/* Action Trigger Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Optional prompt tweak (e.g. 'Emphasize SQL injection probes and JWT expiry checks')..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing DeepSeek Tests...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{suite ? 'Regenerate Test Suite' : 'Generate Test Cases'}</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Generation Notice</div>
                  <div className="text-[11px] leading-relaxed">{error}</div>
                </div>
              </div>
            )}
          </div>

          {/* Test Cases Explorer */}
          {suite && (
            <div className="space-y-4">
              {/* Executive Summary */}
              {suite.summary && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-indigo-950">AI Test Strategy & Coverage Summary</div>
                    <p className="text-xs text-indigo-800/90 mt-1 leading-relaxed">{suite.summary}</p>
                  </div>
                </div>
              )}

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'all' ? 'All Test Cases' : cat}
                  </button>
                ))}
              </div>

              {/* Split Screen Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* List of Test Cases */}
                <div className="lg:col-span-5 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {filteredTests.map((tc) => {
                    const isSelected = selectedTestCase?.id === tc.id;
                    return (
                      <div
                        key={tc.id}
                        onClick={() => setSelectedTestCase(tc)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/10'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadgeClass(
                              tc.category
                            )}`}
                          >
                            {tc.category}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            Exp: {tc.expected_status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{tc.name}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">{tc.description}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Test Detail Inspector */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  {selectedTestCase ? (
                    <>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                            <span>{selectedTestCase.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {selectedTestCase.description}
                          </p>
                        </div>

                        {onLoadIntoSandbox && (
                          <button
                            onClick={() => {
                              onLoadIntoSandbox(selectedTestCase);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Load in Sandbox</span>
                          </button>
                        )}
                      </div>

                      {/* Request Payload preview */}
                      {selectedTestCase.request_body && (
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                            <span>Request Body</span>
                            <button
                              onClick={() =>
                                handleCopy(
                                  JSON.stringify(selectedTestCase.request_body, null, 2),
                                  'body'
                                )
                              }
                              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                            >
                              {copiedId === 'body' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === 'body' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="p-3 bg-slate-900 text-emerald-400 text-xs font-mono rounded-xl overflow-x-auto max-h-40">
                            {JSON.stringify(selectedTestCase.request_body, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Assertions */}
                      {selectedTestCase.assertions && selectedTestCase.assertions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-700 mb-1.5">Validation Assertions</div>
                          <ul className="space-y-1">
                            {selectedTestCase.assertions.map((ast, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-700 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60 font-mono"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{ast}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      Select a test case on the left to inspect parameters and assertions.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Powered by <strong className="text-slate-800">DeepSeek v4.1 Flash via NVIDIA NIM</strong>
          </div>
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
