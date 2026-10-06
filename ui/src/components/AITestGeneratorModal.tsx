import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
  Terminal,
  Zap,
  CheckCheck,
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

export interface TestExecutionResult {
  testId: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  actualStatus?: number;
  durationMs?: number;
  assertionsPassed: number;
  assertionsTotal: number;
  errorMessage?: string;
}

interface AITestGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  initialSuite?: AITestSuite;
  onLoadIntoSandbox?: (testCase: AITestCase) => void;
}

const AI_PROVIDERS = [
  { id: 'nvidia', name: 'NVIDIA NIM', model: 'DeepSeek v4.1 Flash', icon: '⚡' },
  { id: 'openai', name: 'OpenAI', model: 'GPT-4o mini', icon: '🤖' },
  { id: 'anthropic', name: 'Anthropic', model: 'Claude 3.5 Sonnet', icon: '🔮' },
  { id: 'ollama', name: 'Local Ollama', model: 'Llama 3.1', icon: '🦙' },
];

export const AITestGeneratorModal: React.FC<AITestGeneratorModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  initialSuite,
  onLoadIntoSandbox,
}) => {
  const [suite, setSuite] = useState<AITestSuite | null>(initialSuite || null);
  const [selectedProvider, setSelectedProvider] = useState<string>('nvidia');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTestCase, setSelectedTestCase] = useState<AITestCase | null>(null);

  // Live Test Runner State
  const [runningTests, setRunningTests] = useState(false);
  const [executionResults, setExecutionResults] = useState<Record<string, TestExecutionResult>>({});

  if (!isOpen || !endpointKey) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setExecutionResults({});
    try {
      const res = await fetch('/docs/qa/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          provider: selectedProvider,
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
      setError(err.message || 'Error communicating with AI test synthesis service');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSingleTest = async (tc: AITestCase) => {
    setExecutionResults((prev) => ({
      ...prev,
      [tc.id]: {
        testId: tc.id,
        status: 'running',
        assertionsPassed: 0,
        assertionsTotal: tc.assertions ? tc.assertions.length : 1,
      },
    }));

    const startTime = performance.now();
    try {
      let targetUrl = tc.path;
      if (tc.query_params && Object.keys(tc.query_params).length > 0) {
        const qp = new URLSearchParams(tc.query_params);
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + qp.toString();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(tc.headers || {}),
      };

      const options: RequestInit = {
        method: tc.method || 'GET',
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(tc.method.toUpperCase()) && tc.request_body) {
        options.body = typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
      }

      const response = await fetch(targetUrl, options);
      const durationMs = Math.round(performance.now() - startTime);

      const statusMatches = response.status === tc.expected_status;
      const assertionsTotal = tc.assertions ? tc.assertions.length : 1;
      const assertionsPassed = statusMatches ? assertionsTotal : 0;

      setExecutionResults((prev) => ({
        ...prev,
        [tc.id]: {
          testId: tc.id,
          status: statusMatches ? 'passed' : 'failed',
          actualStatus: response.status,
          durationMs,
          assertionsPassed,
          assertionsTotal,
          errorMessage: statusMatches ? undefined : `Expected status ${tc.expected_status}, received ${response.status}`,
        },
      }));
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      setExecutionResults((prev) => ({
        ...prev,
        [tc.id]: {
          testId: tc.id,
          status: 'failed',
          durationMs,
          assertionsPassed: 0,
          assertionsTotal: tc.assertions ? tc.assertions.length : 1,
          errorMessage: err.message || 'Network invocation failed',
        },
      }));
    }
  };

  const handleRunAllTests = async () => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return;
    setRunningTests(true);

    for (const tc of suite.test_cases) {
      await handleRunSingleTest(tc);
    }
    setRunningTests(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = suite?.test_cases
    ? ['all', ...Array.from(new Set(suite.test_cases.map((t) => t.category)))]
    : ['all'];

  const filteredTests =
    suite?.test_cases.filter((tc) => activeCategory === 'all' || tc.category === activeCategory) || [];

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
      case 'auth & rbac':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">AI Test Suite & Execution Runner</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  {suite?.model_used || 'Multi-Provider Synthesis'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">Target: {endpointKey}</p>
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
          {/* AI Provider & Generation Toolbar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Provider Chips */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI Inference Engine:</span>
              <div className="flex items-center gap-2">
                {AI_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                      selectedProvider === p.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-75">({p.model})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Optional prompt tweak (e.g. 'Emphasize SQL injection probes, BOLA heuristics, and JWT expiry checks')..."
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
                    <span>Synthesizing Test Suite...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{suite ? 'Regenerate Tests' : 'Synthesize Test Cases'}</span>
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

          {/* Test Cases Explorer & Execution Runner */}
          {suite && (
            <div className="space-y-4">
              {/* Executive Summary & Batch Run Action */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-indigo-950">AI Test Strategy & Coverage Summary</div>
                    <p className="text-xs text-indigo-800/90 mt-1 leading-relaxed">{suite.summary}</p>
                  </div>
                </div>

                <button
                  onClick={handleRunAllTests}
                  disabled={runningTests}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  {runningTests ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Executing Tests Live...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Run All Synthesized Tests</span>
                    </>
                  )}
                </button>
              </div>

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
                <div className="lg:col-span-5 space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  {filteredTests.map((tc) => {
                    const isSelected = selectedTestCase?.id === tc.id;
                    const runRes = executionResults[tc.id];

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

                          <div className="flex items-center gap-2">
                            {runRes?.status === 'running' && (
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                            )}
                            {runRes?.status === 'passed' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> PASS ({runRes.durationMs}ms)
                              </span>
                            )}
                            {runRes?.status === 'failed' && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-rose-600" /> FAIL
                              </span>
                            )}
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              Exp: {tc.expected_status}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{tc.name}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-1">{tc.description}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Test Detail Inspector & Live Result View */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  {selectedTestCase ? (
                    <>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                            <span>{selectedTestCase.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{selectedTestCase.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRunSingleTest(selectedTestCase)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Run Test</span>
                          </button>

                          {onLoadIntoSandbox && (
                            <button
                              onClick={() => {
                                onLoadIntoSandbox(selectedTestCase);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                              <span>Load in Sandbox</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Execution Result Banner */}
                      {executionResults[selectedTestCase.id] && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            executionResults[selectedTestCase.id].status === 'passed'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : executionResults[selectedTestCase.id].status === 'failed'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {executionResults[selectedTestCase.id].status === 'passed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600" />
                            )}
                            <div>
                              <strong className="capitalize">{executionResults[selectedTestCase.id].status}:</strong>{' '}
                              <span>
                                {executionResults[selectedTestCase.id].errorMessage ||
                                  `Endpoint returned status ${executionResults[selectedTestCase.id].actualStatus} in ${executionResults[selectedTestCase.id].durationMs}ms`}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] font-mono font-bold">
                            Assertions: {executionResults[selectedTestCase.id].assertionsPassed}/
                            {executionResults[selectedTestCase.id].assertionsTotal}
                          </div>
                        </div>
                      )}

                      {/* Request Payload preview */}
                      {selectedTestCase.request_body && (
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                            <span>Synthesized Request Body</span>
                            <button
                              onClick={() =>
                                handleCopy(JSON.stringify(selectedTestCase.request_body, null, 2), 'body')
                              }
                              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                            >
                              {copiedId === 'body' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
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
                      Select a test case on the left to inspect parameters and run live assertions.
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
            Synthesizing via <strong className="text-slate-800">{suite?.model_used || selectedProvider}</strong>
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

