import React, { useState, useEffect } from 'react';
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
  Key,
  Sliders,
  ChevronDown,
  ExternalLink,
  Gift,
  HelpCircle,
  Activity,
  Gauge,
  Download,
  Code2,
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
  /** Full endpoint catalog (e.g. "GET /api/v1/pets") enabling multi-endpoint batch generation & execution. */
  endpointsList?: string[];
}

// Enhanced list of supported AI Inference Engines & Models
export interface AIModelOption {
  id: string;
  name: string;
  contextWindow?: string;
  description: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  company: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  icon: string;
  category: 'cloud' | 'local' | 'speed' | 'frontier';
  defaultModel: string;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  consoleUrl?: string;
  freeTier?: {
    isFree: boolean;
    quotaText: string;
    docsUrl: string;
    instructions: string;
  };
  models: AIModelOption[];
}

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    company: 'NVIDIA',
    tagline: 'Hardware accelerated DeepSeek & open models',
    badge: 'Recommended',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: '⚡',
    category: 'frontier',
    defaultModel: 'deepseek-ai/deepseek-v4.1-flash',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyPlaceholder: 'nvapi-...',
    consoleUrl: 'https://build.nvidia.com/',
    freeTier: {
      isFree: true,
      quotaText: '1,000 Free Inference Credits',
      docsUrl: 'https://build.nvidia.com/',
      instructions: 'Sign up for NVIDIA Build with your Google or work account to receive 1,000 free API credits instantly.',
    },
    models: [
      { id: 'deepseek-ai/deepseek-v4.1-flash', name: 'DeepSeek v4.1 Flash', description: 'Ultra-low latency reasoning & schema testing' },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 Reasoning', description: 'Maximum depth chain-of-thought logic synthesis' },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', description: 'General high-fidelity OpenAPI analysis' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    tagline: 'Industry benchmark frontier models',
    badge: 'Popular',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    icon: '🤖',
    category: 'frontier',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-proj-...',
    consoleUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, cost-efficient automated testing' },
      { id: 'gpt-4o', name: 'GPT-4o (Omni)', description: 'Flagship multimodal reasoning & security probes' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning)', description: 'Next-gen fast STEM reasoning with structured outputs' },
      { id: 'o1', name: 'o1 (Full Reasoning)', description: 'Deep chain-of-thought mathematical & security logic' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    company: 'Anthropic',
    tagline: 'Unmatched nuance, safety & code generation',
    badge: 'Precision',
    badgeColor: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    icon: '🔮',
    category: 'frontier',
    defaultModel: 'claude-sonnet-5-5',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyPlaceholder: 'sk-ant-...',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', description: 'Recommended default: high intelligence, speed & deep coding' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', description: 'Ultra-low latency test generation and data extraction' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', description: 'Flagship depth for complex architectures and threat models' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    company: 'Groq LPU™',
    tagline: 'Instant token generation (500+ tokens/sec)',
    badge: 'Free Tier Available',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    icon: '⚡',
    category: 'speed',
    defaultModel: 'openai/gpt-oss-120b',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    consoleUrl: 'https://console.groq.com/keys',
    freeTier: {
      isFree: true,
      quotaText: '14,400 requests/day (Free Forever)',
      docsUrl: 'https://console.groq.com/keys',
      instructions: 'Sign up in 30 seconds with Google/GitHub to get a free API key with 14,400 daily requests.',
    },
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Active Flagship)', description: 'Full reasoning, 131k context & structured JSON output on Groq' },
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B (High Speed)', description: 'Ultra-low latency open-weights reasoning model' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', description: 'Multimodal intelligence & deep structured QA validation' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    company: 'Google AI Studio',
    tagline: 'Huge context windows & native OpenAPI reasoning',
    badge: '1,500 req/day Free',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: '✨',
    category: 'frontier',
    defaultModel: 'gemini-3.8-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIzaSy...',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    freeTier: {
      isFree: true,
      quotaText: '15 RPM / 1,500 req/day (Free Tier)',
      docsUrl: 'https://aistudio.google.com/app/apikey',
      instructions: 'Sign in with your standard Google Account and click "Create API key" for instant free access.',
    },
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Google recommendation: latest ultra-fast reasoning with 1M context' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', description: 'Advanced architectural reasoning for complex OpenAPI schemas' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub Models',
    company: 'GitHub & Azure AI',
    tagline: 'Free sandbox playground for logged-in GitHub developers',
    badge: 'Free with GitHub',
    badgeColor: 'bg-slate-900/10 text-slate-800 border-slate-900/20',
    icon: '🐙',
    category: 'cloud',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://models.inference.ai.azure.com',
    keyPlaceholder: 'ghp_... or github_pat_...',
    consoleUrl: 'https://github.com/settings/tokens',
    freeTier: {
      isFree: true,
      quotaText: '150 req/day (Free for GitHub accounts)',
      docsUrl: 'https://github.com/settings/tokens',
      instructions: 'Generate a classic GitHub Personal Access Token (PAT) with read permission to access GitHub Models for free.',
    },
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (via GitHub)', description: 'Fast automated test generation hosted on Azure AI' },
      { id: 'meta-llama-3.1-70b-instruct', name: 'Llama 3.1 70B (via GitHub)', description: 'Free open weights on GitHub Models' },
      { id: 'mistral-large-2407', name: 'Mistral Large (via GitHub)', description: 'Enterprise reasoning hosted by GitHub' },
    ],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Inference',
    company: 'Hugging Face',
    tagline: 'Serverless inference router for open-source AI models',
    badge: 'Free Serverless',
    badgeColor: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    icon: '🤗',
    category: 'cloud',
    defaultModel: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    keyPlaceholder: 'hf_...',
    consoleUrl: 'https://huggingface.co/settings/tokens',
    freeTier: {
      isFree: true,
      quotaText: 'Free Serverless Rate Limits',
      docsUrl: 'https://huggingface.co/settings/tokens',
      instructions: 'Create a free Hugging Face account and generate a free Read Token to test community models.',
    },
    models: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B', description: 'Exceptional open-source test engineering model' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', description: 'Hugging Face serverless endpoint' },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'DeepSeek R1 Distill 32B', description: 'Reasoning model on Hugging Face Hub' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral & Codestral',
    company: 'Mistral AI',
    tagline: 'European frontier open-weight models',
    badge: 'Developer Choice',
    badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    icon: '🌪️',
    category: 'cloud',
    defaultModel: 'codestral-latest',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    keyPlaceholder: 'mis_...',
    consoleUrl: 'https://console.mistral.ai/api-keys/',
    models: [
      { id: 'codestral-latest', name: 'Codestral Latest', description: 'Purpose-built for API test code & assertion synthesis' },
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Top-tier multilingual and edge-case intelligence' },
      { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Efficient balanced reasoning for fast schema parsing' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Direct',
    company: 'DeepSeek AI',
    tagline: 'Native official DeepSeek API endpoints',
    badge: 'Economical',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    icon: '🐳',
    category: 'frontier',
    defaultModel: 'deepseek-flash',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    freeTier: {
      isFree: true,
      quotaText: 'Sign-up Free Balance Included',
      docsUrl: 'https://platform.deepseek.com/api_keys',
      instructions: 'Log in with mobile or email at platform.deepseek.com to generate your API key with trial balance.',
    },
    models: [
      { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', description: 'Recommended default: 1M context, ultra-fast QA generation' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: 'Maximum depth reasoning model for complex security & API logic' },
    ],
  },
  {
    id: 'ollama',
    name: 'Local Ollama',
    company: 'Self-Hosted (Local)',
    tagline: '100% private, air-gapped on your local hardware',
    badge: '100% Free & Offline',
    badgeColor: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    icon: '🦙',
    category: 'local',
    defaultModel: 'llama3.1:latest',
    defaultBaseUrl: 'http://localhost:11434',
    keyPlaceholder: 'None required (local endpoint)',
    freeTier: {
      isFree: true,
      quotaText: 'Unlimited / Zero Cost / No Internet',
      docsUrl: 'https://ollama.com/download',
      instructions: 'Run `ollama run llama3.1` in your terminal. No accounts, tokens, or network connection required.',
    },
    models: [
      { id: 'llama3.1:latest', name: 'Llama 3.1 (Local)', description: 'Standard local 8B model' },
      { id: 'deepseek-coder-v2:latest', name: 'DeepSeek Coder V2 (Local)', description: 'Specialized API coding weights' },
      { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder (Local)', description: 'High precision code & schema validation' },
    ],
  },
];

export const AITestGeneratorModal: React.FC<AITestGeneratorModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  initialSuite,
  onLoadIntoSandbox,
  endpointsList = [],
}) => {
  const [suite, setSuite] = useState<AITestSuite | null>(initialSuite || null);
  const [selectedProvider, setSelectedProvider] = useState<string>('nvidia');
  const [selectedModel, setSelectedModel] = useState<string>('deepseek-ai/deepseek-v4.1-flash');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTestCase, setSelectedTestCase] = useState<AITestCase | null>(null);

  // Per-Provider API Key & Endpoint overrides stored in localStorage
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('apidocs_ai_keys') || '{}');
    } catch {
      return {};
    }
  });
  const [customBaseUrls, setCustomBaseUrls] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('apidocs_ai_base_urls') || '{}');
    } catch {
      return {};
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  // Live Test Runner State
  const [runningTests, setRunningTests] = useState(false);
  const [executionResults, setExecutionResults] = useState<Record<string, TestExecutionResult>>({});

  // Concurrency & Burst Stress Testing State
  const [showStressRunner, setShowStressRunner] = useState(false);
  const [concurrencyLevel, setConcurrencyLevel] = useState<number>(5);
  const [totalRequestsTarget, setTotalRequestsTarget] = useState<number>(25);
  const [runningStress, setRunningStress] = useState(false);
  const [stressMetrics, setStressMetrics] = useState<{
    completed: number;
    successful: number;
    failed: number;
    rateLimited: number;
    rps: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    durationMs: number;
  } | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'k6' | 'locust'>('k6');
  const [exportCopied, setExportCopied] = useState(false);

  // Test-case selection: run only checked scenarios instead of the whole suite.
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());

  // Multi-endpoint batch mode: pick endpoints from the catalog, then generate
  // and optionally execute suites for every checked endpoint in one action.
  const [targetEndpoints, setTargetEndpoints] = useState<Set<string>>(new Set([endpointKey]));
  const [showEndpointPicker, setShowEndpointPicker] = useState(false);
  const [batchSuites, setBatchSuites] = useState<Record<string, AITestSuite>>({});
  const [batchResults, setBatchResults] = useState<Record<string, Record<string, TestExecutionResult>>>({});
  const [batchProgress, setBatchProgress] = useState<{ current: string; done: number; total: number } | null>(null);
  const [batchAutoRun, setBatchAutoRun] = useState(true);
  const [reportSavedAt, setReportSavedAt] = useState<string | null>(null);
  // Endpoint whose suite is currently shown in the primary inspection pane.
  const [activeEndpointView, setActiveEndpointView] = useState<string>(endpointKey);

  const activeProvider = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0];

  // Update selected model when provider changes
  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    const p = AI_PROVIDERS.find((item) => item.id === providerId);
    if (p) {
      setSelectedModel(p.defaultModel);
    }
    setIsDropdownOpen(false);
  };

  const handleUpdateKey = (provider: string, key: string) => {
    const next = { ...providerKeys, [provider]: key };
    setProviderKeys(next);
    try {
      localStorage.setItem('apidocs_ai_keys', JSON.stringify(next));
    } catch {}
  };

  const handleUpdateBaseUrl = (provider: string, url: string) => {
    const next = { ...customBaseUrls, [provider]: url };
    setCustomBaseUrls(next);
    try {
      localStorage.setItem('apidocs_ai_base_urls', JSON.stringify(next));
    } catch {}
  };

  if (!isOpen || !endpointKey) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setExecutionResults({});
    try {
      const activeKey = providerKeys[selectedProvider] || '';
      const activeBaseUrl = customBaseUrls[selectedProvider] || '';

      const res = await fetch('/docs/qa/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          endpoint_key: endpointKey,
          custom_prompt: customPrompt,
          api_key: activeKey,
          base_url: activeBaseUrl,
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

    // Automatically sync AI Suite run summary to QA Tracker
    try {
      // Calculate latest results
      setTimeout(async () => {
        let total = suite.test_cases.length;
        let passed = 0;
        let failed = 0;
        let latencies: number[] = [];

        for (const tc of suite.test_cases) {
          const res = executionResults[tc.id];
          if (res?.status === 'passed') passed++;
          else if (res?.status === 'failed') failed++;
          if (res?.durationMs) latencies.push(res.durationMs);
        }

        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
        const overallStatus = passed === total ? 'passed' : (failed > 0 ? 'failed' : 'retest');

        await fetch('/docs/qa/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint_key: endpointKey,
            status: overallStatus,
            tester: `AI QA Runner (${suite.model_used || selectedProvider})`,
            comment: `AI Test Run: ${passed}/${total} passed (${passRate}%) across ${suite.test_cases.length} scenarios.`,
            execution_summary: {
              total_tests: total,
              passed,
              failed,
              pass_rate: passRate,
              avg_latency_ms: avgLatency,
              run_at: new Date().toISOString(),
            },
          }),
        });
      }, 500);
    } catch {}
  };

  const handleToggleTestSelected = (id: string) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTests = () => {
    if (!suite) return;
    const allIds = filteredTests.map((tc) => tc.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedTestIds.has(id));
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  // Run only the checked test cases (falls back to the full suite if none checked).
  const handleRunSelectedTests = async () => {
    if (!suite?.test_cases?.length) return;
    const targets = suite.test_cases.filter((tc) => selectedTestIds.has(tc.id));
    const casesToRun = targets.length > 0 ? targets : suite.test_cases;
    setRunningTests(true);
    for (const tc of casesToRun) {
      await handleRunSingleTest(tc);
    }
    setRunningTests(false);

    const total = casesToRun.length;
    let passed = 0;
    let failed = 0;
    const latencies: number[] = [];
    casesToRun.forEach((tc) => {
      const res = executionResults[tc.id];
      if (res?.status === 'passed') passed++;
      else if (res?.status === 'failed') failed++;
      if (res?.durationMs) latencies.push(res.durationMs);
    });
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const scope = targets.length > 0 ? `selected subset (${targets.length}/${suite.test_cases.length} cases)` : 'full suite';
    const overallStatus = passed === total && total > 0 ? 'passed' : failed > 0 ? 'failed' : 'retest';

    try {
      await fetch('/docs/qa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_key: endpointKey,
          status: overallStatus,
          tester: `AI QA Runner (${suite.model_used || selectedProvider})`,
          comment: `AI Test Run [${scope}]: ${passed}/${total} passed (${passRate}%).`,
          execution_summary: {
            total_tests: total,
            passed,
            failed,
            pass_rate: passRate,
            avg_latency_ms: avgLatency,
            run_at: new Date().toISOString(),
          },
        }),
      });
    } catch {}
  };

  // ---------- Report persistence ----------

  const buildReportPayload = () => {
    const results = suite?.test_cases.map((tc) => ({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      method: tc.method,
      path: tc.path,
      expected_status: tc.expected_status,
      selected: selectedTestIds.has(tc.id),
      result: executionResults[tc.id] || null,
    })) || [];
    const passed = results.filter((r) => r.result?.status === 'passed').length;
    const failed = results.filter((r) => r.result?.status === 'failed').length;
    return {
      report_version: 1,
      generated_at: new Date().toISOString(),
      endpoint_key: endpointKey,
      provider: selectedProvider,
      model: suite?.model_used || selectedModel,
      suite_summary: suite?.summary || '',
      totals: { total: results.length, passed, failed },
      test_cases: results,
    };
  };

  const buildMarkdownReport = (): string => {
    const p = buildReportPayload();
    const lines: string[] = [
      `# AI Test Execution Report`,
      ``,
      `- **Endpoint:** ${p.endpoint_key}`,
      `- **Provider / Model:** ${p.provider} (${p.model})`,
      `- **Generated:** ${p.generated_at}`,
      `- **Result:** ${p.totals.passed} passed / ${p.totals.failed} failed of ${p.totals.total}`,
      ``,
      p.suite_summary ? `> ${p.suite_summary}` : '',
      ``,
      `| # | Test | Category | Expected | Actual | Status | Duration |`,
      `|---|------|----------|----------|--------|--------|----------|`,
    ];
    p.test_cases.forEach((tc, i) => {
      const status = tc.result?.status || 'not run';
      const actual = tc.result?.actualStatus ?? '-';
      const dur = tc.result?.durationMs != null ? `${tc.result.durationMs}ms` : '-';
      const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
      lines.push(`| ${i + 1} | ${tc.name} | ${tc.category} | ${tc.expected_status} | ${actual} | ${icon} ${status} | ${dur} |`);
    });
    return lines.join('\n');
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const safeFileStamp = () => endpointKey.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);

  const handleSaveReport = (format: 'json' | 'markdown') => {
    if (format === 'json') {
      downloadFile(`ai-test-report-${safeFileStamp()}.json`, JSON.stringify(buildReportPayload(), null, 2), 'application/json');
    } else {
      downloadFile(`ai-test-report-${safeFileStamp()}.md`, buildMarkdownReport(), 'text/markdown');
    }
    setReportSavedAt(new Date().toISOString());
  };

  // ---------- Multi-endpoint batch generation & execution ----------

  const handleToggleTargetEndpoint = (ep: string) => {
    setTargetEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(ep)) next.delete(ep);
      else next.add(ep);
      return next;
    });
  };

  const handleRunBatch = async () => {
    const targets = endpointsList.filter((ep) => targetEndpoints.has(ep));
    if (targets.length === 0) return;
    setBatchProgress({ current: targets[0], done: 0, total: targets.length });

    const suites: Record<string, AITestSuite> = {};
    const results: Record<string, Record<string, TestExecutionResult>> = {};

    for (let i = 0; i < targets.length; i++) {
      const ep = targets[i];
      setBatchProgress({ current: ep, done: i, total: targets.length });
      try {
        const res = await fetch('/docs/qa/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({
            provider: selectedProvider,
            model: selectedModel,
            endpoint_key: ep,
            custom_prompt: customPrompt,
            api_key: providerKeys[selectedProvider] || '',
            base_url: customBaseUrls[selectedProvider] || '',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'generation failed');
        const genSuite: AITestSuite = data.suite;
        suites[ep] = genSuite;

        if (batchAutoRun && genSuite?.test_cases?.length > 0) {
          const epResults: Record<string, TestExecutionResult> = {};
          for (const tc of genSuite.test_cases) {
            const start = performance.now();
            let status: TestExecutionResult['status'] = 'failed';
            let actual: number | undefined;
            try {
              let url = tc.path;
              if (tc.query_params && Object.keys(tc.query_params).length > 0) {
                url += (url.includes('?') ? '&' : '?') + new URLSearchParams(tc.query_params).toString();
              }
              const opts: RequestInit = { method: tc.method || 'GET', headers: { 'Content-Type': 'application/json', ...(tc.headers || {}) } };
              if (['POST', 'PUT', 'PATCH'].includes((tc.method || 'GET').toUpperCase()) && tc.request_body) {
                opts.body = typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
              }
              const resp = await fetch(url, opts);
              actual = resp.status;
              status = resp.status === tc.expected_status ? 'passed' : 'failed';
            } catch (e: any) {
              status = 'failed';
            }
            epResults[tc.id] = {
              testId: tc.id,
              status,
              actualStatus: actual,
              durationMs: Math.round(performance.now() - start),
              assertionsPassed: status === 'passed' ? (tc.assertions?.length || 1) : 0,
              assertionsTotal: tc.assertions?.length || 1,
              errorMessage: status === 'failed' && actual != null ? `Expected ${tc.expected_status}, received ${actual}` : 'Network invocation failed',
            };
          }
          results[ep] = epResults;

          // Persist per-endpoint QA summary for the batch run.
          const passed = Object.values(epResults).filter((r) => r.status === 'passed').length;
          const total = genSuite.test_cases.length;
          try {
            await fetch('/docs/qa/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint_key: ep,
                status: passed === total ? 'passed' : 'failed',
                tester: `AI Batch Runner (${selectedProvider})`,
                comment: `Batch AI run: ${passed}/${total} passed.`,
                execution_summary: {
                  total_tests: total,
                  passed,
                  failed: total - passed,
                  pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0,
                  avg_latency_ms: 0,
                  run_at: new Date().toISOString(),
                },
              }),
            });
          } catch {}
        }
      } catch (e: any) {
        // Record the failure but continue the batch.
        suites[ep] = { endpoint_key: ep, summary: `Generation failed: ${e.message}`, model_used: selectedModel, generated_at: new Date().toISOString(), test_cases: [] };
      }
    }

    setBatchSuites(suites);
    setBatchResults(results);
    setBatchProgress({ current: '', done: targets.length, total: targets.length });
    // Point the primary pane at the last successful suite for inspection.
    const lastEp = targets.reverse().find((ep) => suites[ep]?.test_cases?.length > 0);
    if (lastEp) {
      setActiveEndpointView(lastEp);
      setSuite(suites[lastEp]);
      setSelectedTestCase(suites[lastEp].test_cases[0] || null);
      setExecutionResults(results[lastEp] || {});
    }
  };

  // High-Throughput Concurrent Burst Stress Engine
  const handleRunConcurrentStress = async () => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return;
    setRunningStress(true);
    setStressMetrics(null);

    const startTime = performance.now();
    let completedCount = 0;
    let successfulCount = 0;
    let failedCount = 0;
    let rateLimitedCount = 0;
    const latencies: number[] = [];

    // Worker queue with concurrency limiter
    const testCasesPool = suite.test_cases;
    let queueIndex = 0;

    const worker = async () => {
      while (queueIndex < totalRequestsTarget) {
        const currentReq = queueIndex++;
        const tc = testCasesPool[currentReq % testCasesPool.length];
        const reqStart = performance.now();

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

          const res = await fetch(targetUrl, options);
          const reqDuration = Math.round(performance.now() - reqStart);
          latencies.push(reqDuration);
          completedCount++;

          if (res.status === 429) {
            rateLimitedCount++;
          } else if (res.status === tc.expected_status || (res.status >= 200 && res.status < 400)) {
            successfulCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
          completedCount++;
        }

        // Real-time metrics tick
        const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
        setStressMetrics({
          completed: completedCount,
          successful: successfulCount,
          failed: failedCount,
          rateLimited: rateLimitedCount,
          rps: Math.round((completedCount / elapsedSec) * 10) / 10,
          avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
          p95LatencyMs: latencies.length > 0 ? [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || 0 : 0,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    };

    // Launch concurrent worker pool
    const activeWorkers = Array.from({ length: Math.min(concurrencyLevel, totalRequestsTarget) }, () => worker());
    await Promise.allSettled(activeWorkers);

    const totalElapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
    latencies.sort((a, b) => a - b);
    const finalMetrics = {
      completed: completedCount,
      successful: successfulCount,
      failed: failedCount,
      rateLimited: rateLimitedCount,
      rps: Math.round((completedCount / totalElapsedSec) * 10) / 10,
      avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p95LatencyMs: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || 0 : 0,
      durationMs: Math.round(performance.now() - startTime),
    };
    setStressMetrics(finalMetrics);

    // Automatically sync Stress test metrics to QA Tracker
    try {
      await fetch('/docs/qa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_key: endpointKey,
          comment: `Stress Tested: ${concurrencyLevel}x parallel, ${finalMetrics.rps} req/s, P95 ${finalMetrics.p95LatencyMs}ms (429: ${finalMetrics.rateLimited})`,
          stress_metrics: {
            concurrency_level: concurrencyLevel,
            total_requests: completedCount,
            successful: successfulCount,
            failed: failedCount,
            rate_limited: rateLimitedCount,
            rps: finalMetrics.rps,
            avg_latency_ms: finalMetrics.avgLatencyMs,
            p95_latency_ms: finalMetrics.p95LatencyMs,
            duration_ms: finalMetrics.durationMs,
            run_at: new Date().toISOString(),
          },
        }),
      });
    } catch {}

    setRunningStress(false);
  };

  // Generate k6 Load Test Script
  const generateK6Script = (): string => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return '';
    const origin = window.location.origin;

    const casesCode = suite.test_cases.map((tc, idx) => {
      let url = `${origin}${tc.path}`;
      if (tc.query_params && Object.keys(tc.query_params).length > 0) {
        url += '?' + new URLSearchParams(tc.query_params).toString();
      }
      const headers = JSON.stringify({
        'Content-Type': 'application/json',
        ...(tc.headers || {}),
      }, null, 4);

      const body = tc.request_body
        ? `JSON.stringify(${JSON.stringify(tc.request_body)})`
        : 'null';

      return `  // Scenario ${idx + 1}: ${tc.name} (${tc.category})
  {
    const res = http.${tc.method.toLowerCase()}('${url}', ${body}, { headers: ${headers} });
    check(res, {
      'status is ${tc.expected_status}': (r) => r.status === ${tc.expected_status},
    });
    sleep(0.05);
  }`;
    }).join('\n\n');

    return `import http from 'k6/http';
import { check, sleep } from 'k6';

// Automated k6 Performance & Stress Script for: ${endpointKey}
// Generated via go-apidocs AI Inference Engine (${suite.model_used})
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 virtual users
    { duration: '1m', target: 50 },   // Stress plateau at 50 virtual users
    { duration: '20s', target: 0 },   // Graceful cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    http_req_failed: ['rate<0.02'],   // Failure rate under 2%
  },
};

export default function () {
${casesCode}
}
`;
  };

  // Generate Locust Python Load Test Script
  const generateLocustScript = (): string => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return '';

    const tasks = suite.test_cases.map((tc, idx) => {
      let path = tc.path;
      if (tc.query_params && Object.keys(tc.query_params).length > 0) {
        path += '?' + new URLSearchParams(tc.query_params).toString();
      }
      const headers = JSON.stringify({
        'Content-Type': 'application/json',
        ...(tc.headers || {}),
      });

      const jsonPayload = tc.request_body ? `, json=${JSON.stringify(tc.request_body)}` : '';

      return `    @task
    def scenario_${idx + 1}_${tc.id.replace(/[^a-zA-Z0-9_]/g, '_')}(self):
        """${tc.name} - ${tc.category}"""
        with self.client.${tc.method.toLowerCase()}("${path}", headers=${headers}${jsonPayload}, catch_response=True) as res:
            if res.status_code == ${tc.expected_status}:
                res.success()
            else:
                res.failure(f"Expected ${tc.expected_status}, got {res.status_code}")`;
    }).join('\n\n');

    return `from locust import HttpUser, task, between

# Automated Locust Stress & Concurrency Test for: ${endpointKey}
# Generated via go-apidocs AI Engine (${suite.model_used})

class APIStressUser(HttpUser):
    wait_time = between(0.01, 0.1)

${tasks}
`;
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
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Human Designed Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-1/4 w-96 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-500 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm font-semibold tracking-tight text-white">AI Test Suite & Execution Runner</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-mono font-medium border border-indigo-500/30 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-indigo-400" />
                  {suite?.model_used || activeProvider.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span>Target:</span>
                <span className="text-slate-200 font-bold">{endpointKey}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer relative z-10"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50/60">
          {/* Human-Designed AI Inference Engine Selection Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 relative z-20 overflow-visible">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Engine Selector Dropdown */}
              <div className="space-y-1.5 flex-1 relative z-30">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI Inference Engine & Provider</span>
                </label>

                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full sm:max-w-md px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50 flex items-center justify-between gap-3 text-left transition-all shadow-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{activeProvider.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{activeProvider.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${activeProvider.badgeColor}`}>
                          {activeProvider.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{activeProvider.tagline}</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Modal / Overlay */}
                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-full sm:w-[460px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 max-h-[380px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Choose Inference Provider
                      </div>
                      <div className="space-y-1">
                        {AI_PROVIDERS.map((provider) => {
                          const isSelected = selectedProvider === provider.id;
                          return (
                            <button
                              key={provider.id}
                              type="button"
                              onClick={() => handleSelectProvider(provider.id)}
                              className={`w-full p-2.5 rounded-xl text-left flex items-start gap-3 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/80 border border-indigo-200 text-slate-900'
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="text-xl shrink-0 mt-0.5">{provider.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-bold text-slate-900 truncate">{provider.name}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-medium border ${provider.badgeColor}`}>
                                      {provider.badge}
                                    </span>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{provider.tagline}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Model Picker & Settings Toggle */}
              <div className="flex items-end gap-2.5 flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Inference Model</span>
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 shadow-xs cursor-pointer transition-all"
                  >
                    {activeProvider.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Settings & Credentials Button */}
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Configure custom API Key or Base URL"
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                    showSettings || providerKeys[selectedProvider]
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/10'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  <span>API Key & Settings</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Custom API Credentials & Endpoint Settings Panel */}
            {showSettings && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Configure {activeProvider.name} Credentials & Endpoint</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Stored securely in your local browser storage</span>
                </div>

                {/* Free Tier Guidance Box */}
                {activeProvider.freeTier && (
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Gift className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{activeProvider.freeTier.quotaText}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-200/80 text-emerald-800">
                            No Credit Card Required
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          {activeProvider.freeTier.instructions}
                        </p>
                      </div>
                    </div>

                    <a
                      href={activeProvider.freeTier.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                    >
                      <span>Get Free Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        API Key (Optional override)
                      </label>
                      {activeProvider.consoleUrl && (
                        <a
                          href={activeProvider.consoleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          title={`Open ${activeProvider.company || activeProvider.name} dashboard to generate API key`}
                        >
                          <span>Connect {activeProvider.name}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder={activeProvider.keyPlaceholder}
                      value={providerKeys[selectedProvider] || ''}
                      onChange={(e) => handleUpdateKey(selectedProvider, e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Base URL (Optional custom proxy/endpoint)
                    </label>
                    <input
                      type="text"
                      placeholder={activeProvider.defaultBaseUrl}
                      value={customBaseUrls[selectedProvider] || ''}
                      onChange={(e) => handleUpdateBaseUrl(selectedProvider, e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Prompt tweak & Action Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Optional prompt tweak (e.g. 'Emphasize SQL injection probes, BOLA heuristics, and JWT expiry checks')..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
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

            {/* Multi-Endpoint Batch Generation & Execution */}
            {endpointsList.length > 0 && (
              <div className="pt-1 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>Multi-Endpoint Batch Runner</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                          {targetEndpoints.size} selected
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Generate (and optionally execute) AI test suites for multiple checked endpoints in one pass.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                        checked={batchAutoRun}
                        onChange={(e) => setBatchAutoRun(e.target.checked)}
                      />
                      <span>Execute after generating</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEndpointPicker(!showEndpointPicker)}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Choose Endpoints</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEndpointPicker ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={handleRunBatch}
                      disabled={batchProgress !== null && batchProgress.done < batchProgress.total}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {batchProgress && batchProgress.done < batchProgress.total ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Batch {batchProgress.done + 1}/{batchProgress.total}…</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Run Batch ({targetEndpoints.size})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Endpoint Picker Checklist */}
                {showEndpointPicker && (
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Checked endpoints will be included in the batch run
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTargetEndpoints(new Set(endpointsList))}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetEndpoints(new Set())}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
                      {endpointsList.map((ep) => (
                        <label
                          key={ep}
                          className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                            checked={targetEndpoints.has(ep)}
                            onChange={() => handleToggleTargetEndpoint(ep)}
                          />
                          <span className="text-[11px] font-mono text-slate-700 truncate" title={ep}>{ep}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Batch Results HUD */}
                {batchProgress && batchProgress.done >= batchProgress.total && Object.keys(batchSuites).length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Batch results — click an endpoint to load its suite into the inspector
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(batchSuites).map(([ep, s]) => {
                        const res = batchResults[ep] || {};
                        const passed = Object.values(res).filter((r) => r.status === 'passed').length;
                        const total = s.test_cases.length;
                        const ok = total > 0 && passed === total;
                        return (
                          <button
                            key={ep}
                            type="button"
                            onClick={() => {
                              setActiveEndpointView(ep);
                              setSuite(s);
                              setSelectedTestCase(s.test_cases[0] || null);
                              setExecutionResults(res);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold font-mono border cursor-pointer transition-all ${
                              ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : total === 0
                                ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                            title={`${ep}: ${passed}/${total} passed`}
                          >
                            {ok ? '✅' : total === 0 ? '⚠️' : '❌'} {ep} {total > 0 ? `(${passed}/${total})` : '(gen failed)'}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => downloadFile(
                          `ai-batch-report-${new Date().toISOString().slice(0, 10)}.json`,
                          JSON.stringify({ generated_at: new Date().toISOString(), provider: selectedProvider, model: selectedModel, endpoints: batchSuites, results: batchResults }, null, 2),
                          'application/json'
                        )}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Save Batch Report (JSON)</span>
                      </button>
                    </div>
                  </div>
                )}
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

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Save execution report */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleSaveReport('markdown')}
                      className="px-3 py-2.5 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-r border-slate-200"
                      title="Download execution report as Markdown"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Save Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveReport('json')}
                      className="px-2.5 py-2.5 hover:bg-slate-50 text-slate-500 text-[10px] font-bold font-mono transition-all cursor-pointer"
                      title="Download execution report as JSON"
                    >
                      JSON
                    </button>
                  </div>

                  {/* Export Load Test Script Button */}
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Export as k6 / Locust load testing script"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export k6 / Locust</span>
                  </button>

                  {/* Toggle Stress & Concurrency Runner Panel */}
                  <button
                    type="button"
                    onClick={() => setShowStressRunner(!showStressRunner)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      showStressRunner
                        ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Concurrency & Stress</span>
                  </button>

                  {/* Standard Sequential Run All + Run Selected */}
                  <button
                    onClick={handleRunSelectedTests}
                    disabled={runningTests || runningStress}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    title={selectedTestIds.size > 0 ? `Run ${selectedTestIds.size} checked test case(s)` : 'Run full suite (none checked)'}
                  >
                    {runningTests ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Tests Live...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>{selectedTestIds.size > 0 ? `Run Selected (${selectedTestIds.size})` : 'Run All Tests Live'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Concurrency & Burst Stress Runner HUD Panel */}
              {showStressRunner && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Concurrent Stress & Burst Simulator</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800">
                            Live Endpoint Load
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Dispatches concurrent worker pools to evaluate real-time throughput, P95 latency, and rate limiting (429).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunConcurrentStress}
                      disabled={runningStress || runningTests}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      {runningStress ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Pumping Burst Requests...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-white" />
                          <span>Start Concurrency Test</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Settings Sliders / Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Parallel Workers (Concurrency):</span>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {concurrencyLevel}x parallel
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={concurrencyLevel}
                        disabled={runningStress}
                        onChange={(e) => setConcurrencyLevel(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>1x (Gentle)</span>
                        <span>10x (Moderate)</span>
                        <span>25x (Heavy)</span>
                        <span>50x (Stress)</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-amber-200/80 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Total Burst Iterations:</span>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {totalRequestsTarget} requests
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="200"
                        step="5"
                        value={totalRequestsTarget}
                        disabled={runningStress}
                        onChange={(e) => setTotalRequestsTarget(parseInt(e.target.value, 10))}
                        className="w-full accent-amber-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>5 reqs</span>
                        <span>50 reqs</span>
                        <span>100 reqs</span>
                        <span>200 reqs</span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Telemetry HUD */}
                  {stressMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 animate-in fade-in duration-200">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Throughput</div>
                        <div className="text-base font-extrabold text-indigo-600 mt-0.5 font-mono">{stressMetrics.rps} <span className="text-[10px] text-slate-400 font-normal">req/s</span></div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">P95 Latency</div>
                        <div className="text-base font-extrabold text-amber-600 mt-0.5 font-mono">{stressMetrics.p95LatencyMs} <span className="text-[10px] text-slate-400 font-normal">ms</span></div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Response</div>
                        <div className="text-base font-extrabold text-slate-900 mt-0.5 font-mono">{stressMetrics.avgLatencyMs} <span className="text-[10px] text-slate-400 font-normal">ms</span></div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed / 429</div>
                        <div className="text-base font-extrabold text-slate-900 mt-0.5 font-mono">
                          <span className="text-emerald-600">{stressMetrics.successful}</span>
                          <span className="text-slate-300">/</span>
                          <span className={stressMetrics.rateLimited > 0 ? 'text-amber-600' : 'text-slate-400'}>{stressMetrics.rateLimited}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Load Test Script Export Modal Overlay */}
              {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
                  <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                          <Code2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Export Load & Stress Test Script</h3>
                          <p className="text-[11px] text-slate-500">Ready-to-run automation script incorporating all AI synthesized edge cases</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowExportModal(false)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Format Tabs: k6 vs Locust */}
                    <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setExportFormat('k6')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          exportFormat === 'k6' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Grafana k6 (JavaScript)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportFormat('locust')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          exportFormat === 'locust' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Locust (Python)
                      </button>
                    </div>

                    {/* Code Snippet Box */}
                    <div className="relative rounded-2xl bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[320px] leading-relaxed border border-slate-800">
                      <pre className="whitespace-pre">
                        {exportFormat === 'k6' ? generateK6Script() : generateLocustScript()}
                      </pre>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-slate-500">
                        {exportFormat === 'k6' ? 'Run with: `k6 run loadtest.js`' : 'Run with: `locust -f locustfile.py --host=...`'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const script = exportFormat === 'k6' ? generateK6Script() : generateLocustScript();
                          navigator.clipboard.writeText(script);
                          setExportCopied(true);
                          setTimeout(() => setExportCopied(false), 2000);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        {exportCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Script</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Filter Chips + Select-all toggle */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {suite && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white cursor-pointer whitespace-nowrap select-none hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                      checked={filteredTests.length > 0 && filteredTests.every((tc) => selectedTestIds.has(tc.id))}
                      onChange={handleSelectAllTests}
                    />
                    <span>Select all</span>
                  </label>
                )}
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
                    const isChecked = selectedTestIds.has(tc.id);

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
                          <label
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                              checked={isChecked}
                              onChange={() => handleToggleTestSelected(tc.id)}
                              title="Include this test case in 'Run Selected'"
                            />
                          </label>
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

