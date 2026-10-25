import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Activity,
  Gauge,
  Download,
  Code2,
  GitBranch,
  FolderOpen,
  Trash2,
  ListOrdered,
  Bot,
  Github,
  Heart,
  Wind,
  Waves,
  Server,
  Folder,
  Ban,
  Settings2,

} from 'lucide-react';
import { Modal } from './Modal';

/* ============================================================
   TYPES
   ============================================================ */

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
  /** Raw response body for diff rendering when a test fails */
  responseBody?: string;
}

interface AITestGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  initialSuite?: AITestSuite;
  onLoadIntoSandbox?: (testCase: AITestCase) => void;
  endpointsList?: string[];
}

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

/* ============================================================
   PROVIDER ICON MAP (replaces emoji icons)
   ============================================================ */

const providerIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  nvidia: Zap,
  openai: Bot,
  anthropic: Sparkles,
  groq: Zap,
  gemini: Sparkles,
  github: Github,
  huggingface: Heart,
  mistral: Wind,
  deepseek: Waves,
  ollama: Server,
};

const renderProviderIcon = (id: string, className = 'w-4 h-4') => {
  const Icon = providerIcon[id] || Sparkles;
  return <Icon className={className} />;
};

/* ============================================================
   PROVIDERS
   ============================================================ */

const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    company: 'NVIDIA',
    tagline: 'Hardware accelerated DeepSeek & open models',
    badge: 'Recommended',
    category: 'frontier',
    defaultModel: 'deepseek-ai/deepseek-v4.1-flash',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyPlaceholder: 'nvapi-...',
    consoleUrl: 'https://build.nvidia.com/',
    freeTier: {
      isFree: true,
      quotaText: '1,000 free inference credits',
      docsUrl: 'https://build.nvidia.com/',
      instructions: 'Sign up for NVIDIA Build with Google or work account for 1,000 free API credits instantly.',
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
    category: 'frontier',
    defaultModel: 'claude-sonnet-5-5',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyPlaceholder: 'sk-ant-...',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', description: 'Recommended: high intelligence, speed & deep coding' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', description: 'Ultra-low latency test generation and data extraction' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', description: 'Flagship depth for complex architectures and threat models' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    company: 'Groq LPU',
    tagline: 'Instant token generation (500+ tokens/sec)',
    badge: 'Free tier',
    category: 'speed',
    defaultModel: 'openai/gpt-oss-120b',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    consoleUrl: 'https://console.groq.com/keys',
    freeTier: {
      isFree: true,
      quotaText: '14,400 requests/day (free forever)',
      docsUrl: 'https://console.groq.com/keys',
      instructions: 'Sign up in 30 seconds with Google/GitHub for a free API key with 14,400 daily requests.',
    },
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (flagship)', description: 'Full reasoning, 131k context, structured JSON output' },
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B (high speed)', description: 'Ultra-low latency open-weights reasoning model' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', description: 'Multimodal intelligence & deep structured QA validation' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    company: 'Google AI Studio',
    tagline: 'Huge context windows & native OpenAPI reasoning',
    badge: '1,500 req/day free',
    category: 'frontier',
    defaultModel: 'gemini-3.8-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPlaceholder: 'AIzaSy...',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    freeTier: {
      isFree: true,
      quotaText: '15 RPM / 1,500 req/day',
      docsUrl: 'https://aistudio.google.com/app/apikey',
      instructions: 'Sign in with your Google Account and click "Create API key" for instant free access.',
    },
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Latest ultra-fast reasoning with 1M context' },
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', description: 'Advanced architectural reasoning for complex schemas' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub Models',
    company: 'GitHub & Azure AI',
    tagline: 'Free sandbox playground for logged-in GitHub developers',
    badge: 'Free with GitHub',
    category: 'cloud',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://models.inference.ai.azure.com',
    keyPlaceholder: 'ghp_... or github_pat_...',
    consoleUrl: 'https://github.com/settings/tokens',
    freeTier: {
      isFree: true,
      quotaText: '150 req/day (free for GitHub accounts)',
      docsUrl: 'https://github.com/settings/tokens',
      instructions: 'Generate a classic GitHub PAT with read permission to access GitHub Models for free.',
    },
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (via GitHub)', description: 'Fast automated test generation hosted on Azure AI' },
      { id: 'meta-llama-3.1-70b-instruct', name: 'Llama 3.1 70B (via GitHub)', description: 'Free open weights on GitHub Models' },
      { id: 'mistral-large-2407', name: 'Mistral Large (via GitHub)', description: 'Enterprise reasoning hosted by GitHub' },
    ],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    company: 'Hugging Face',
    tagline: 'Serverless inference router for open-source models',
    badge: 'Free serverless',
    category: 'cloud',
    defaultModel: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    keyPlaceholder: 'hf_...',
    consoleUrl: 'https://huggingface.co/settings/tokens',
    freeTier: {
      isFree: true,
      quotaText: 'Free serverless rate limits',
      docsUrl: 'https://huggingface.co/settings/tokens',
      instructions: 'Create a free Hugging Face account and generate a Read Token.',
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
    badge: 'Developer choice',
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
    category: 'frontier',
    defaultModel: 'deepseek-flash',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    freeTier: {
      isFree: true,
      quotaText: 'Sign-up free balance included',
      docsUrl: 'https://platform.deepseek.com/api_keys',
      instructions: 'Log in at platform.deepseek.com to generate your API key with trial balance.',
    },
    models: [
      { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash', description: '1M context, ultra-fast QA generation' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', description: 'Maximum depth reasoning for complex security logic' },
    ],
  },
  {
    id: 'ollama',
    name: 'Local Ollama',
    company: 'Self-hosted',
    tagline: '100% private, air-gapped on your local hardware',
    badge: 'Free & offline',
    category: 'local',
    defaultModel: 'llama3.1:latest',
    defaultBaseUrl: 'http://localhost:11434',
    keyPlaceholder: 'None required (local endpoint)',
    freeTier: {
      isFree: true,
      quotaText: 'Unlimited / zero cost / no internet',
      docsUrl: 'https://ollama.com/download',
      instructions: 'Run `ollama run llama3.1` in your terminal. No accounts or network required.',
    },
    models: [
      { id: 'llama3.1:latest', name: 'Llama 3.1 (local)', description: 'Standard local 8B model' },
      { id: 'deepseek-coder-v2:latest', name: 'DeepSeek Coder V2 (local)', description: 'Specialized API coding weights' },
      { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder (local)', description: 'High precision code & schema validation' },
    ],
  },
];

/* ============================================================
   HELPERS
   ============================================================ */

const categoryTone = (cat: string): { fg: string; bg: string; bd: string } => {
  const c = cat.toLowerCase();
  if (c.includes('happy'))
    return {
      fg: 'var(--success-500)',
      bg: 'color-mix(in srgb, var(--success-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--success-500) 24%, transparent)',
    };
  if (c.includes('boundary'))
    return {
      fg: 'var(--info-500)',
      bg: 'color-mix(in srgb, var(--info-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--info-500) 24%, transparent)',
    };
  if (c.includes('negative'))
    return {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 24%, transparent)',
    };
  if (c.includes('security') || c.includes('auth') || c.includes('inject'))
    return {
      fg: 'var(--danger-500)',
      bg: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--danger-500) 24%, transparent)',
    };
  return {
    fg: 'var(--text-secondary)',
    bg: 'var(--bg-overlay)',
    bd: 'var(--border-subtle)',
  };
};

const categorizeError = (msg: string): { category: string; hint: string } => {
  const m = msg.toLowerCase();
  if (m.includes('401') || m.includes('unauthorized') || m.includes('api key'))
    return {
      category: 'Authentication failed',
      hint: 'Check that your API key is valid and has permission for this model.',
    };
  if (m.includes('403') || m.includes('forbidden'))
    return {
      category: 'Access forbidden',
      hint: 'Your key does not have access to this model or region.',
    };
  if (m.includes('429') || m.includes('rate limit') || m.includes('quota'))
    return {
      category: 'Rate limited',
      hint: 'You are hitting the provider quota. Wait a minute or switch providers.',
    };
  if (m.includes('404') || m.includes('model not found') || m.includes('unavailable'))
    return {
      category: 'Model unavailable',
      hint: 'This model is not deployed on your provider. Try a different one.',
    };
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('econn'))
    return {
      category: 'Network error',
      hint: 'Could not reach the provider. Check your connection or base URL override.',
    };
  return {
    category: 'Generation failed',
    hint: msg,
  };
};

/* ============================================================
   PRIMITIVES
   ============================================================ */

const Field: React.FC<{ label: string; children: React.ReactNode; right?: React.ReactNode }> = ({
  label,
  children,
  right,
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label
        className="text-[10.5px] font-semibold uppercase"
        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
      >
        {label}
      </label>
      {right}
    </div>
    {children}
  </div>
);

const Input: React.FC<{
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}> = ({ type = 'text', value, onChange, placeholder, mono = true }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full h-8 px-2.5 rounded-[var(--r-sm)] outline-none transition-all text-[12px] ${mono ? 'mono' : ''}`}
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

const PrimaryBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title?: string;
}> = ({ onClick, disabled, children, Icon, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    style={{
      background: 'var(--accent-500)',
      color: 'var(--text-inverse)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
    }}
    onMouseEnter={(e) => {
      if (!disabled) e.currentTarget.style.background = 'var(--accent-400)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--accent-500)';
    }}
  >
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {children}
  </button>
);

const GhostBtn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  Icon?: React.ComponentType<{ className?: string }>;
  title?: string;
}> = ({ onClick, disabled, children, Icon, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    style={{
      background: 'var(--bg-canvas)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = 'var(--bg-hover)';
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--bg-canvas)';
      e.currentTarget.style.color = 'var(--text-secondary)';
      e.currentTarget.style.borderColor = 'var(--border-subtle)';
    }}
  >
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {children}
  </button>
);

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

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

  const [runningTests, setRunningTests] = useState(false);
  const [executionResults, setExecutionResults] = useState<Record<string, TestExecutionResult>>({});

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

  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'k6' | 'locust'>('k6');
  const [exportCopied, setExportCopied] = useState(false);

  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());

  const [targetEndpoints, setTargetEndpoints] = useState<Set<string>>(new Set([endpointKey]));
  const [showEndpointPicker, setShowEndpointPicker] = useState(false);
  const [batchSuites, setBatchSuites] = useState<Record<string, AITestSuite>>({});
  const [batchResults, setBatchResults] = useState<Record<string, Record<string, TestExecutionResult>>>({});
  const [batchProgress, setBatchProgress] = useState<{ current: string; done: number; total: number } | null>(null);
  const [batchAutoRun, setBatchAutoRun] = useState(true);
  const [reportSavedAt, setReportSavedAt] = useState<string | null>(null);
  const lastRunResultsRef = useRef<Record<string, TestExecutionResult>>({});

  const [showSequencePanel, setShowSequencePanel] = useState(false);
  const [sequenceAnalysis, setSequenceAnalysis] = useState<any>(null);
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceSource, setSequenceSource] = useState<'standards' | 'ai'>('standards');
  const [sequenceError, setSequenceError] = useState<string | null>(null);

  const [activeEndpointView, setActiveEndpointView] = useState<string>(endpointKey);

  /* ---- NEW: cancel + progress ---- */
  const generateAbortRef = useRef<AbortController | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const progressTimerRef = useRef<number | null>(null);

  const activeProvider = AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0];

  /* ---- Fetch sequence (preserved) ---- */
  const fetchSequence = async (mode: 'standards' | 'ai') => {
    setSequenceLoading(true);
    setSequenceError(null);
    setSequenceSource(mode);
    try {
      const specRes = await fetch('/docs/swagger.json');
      const spec = await specRes.json();
      if (mode === 'ai') {
        const endpoints: string[] = [];
        const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
        Object.entries(spec.paths || {}).forEach(([path, ops]: [string, any]) => {
          METHODS.forEach((m) => {
            if (ops[m]) endpoints.push(`${m.toUpperCase()} ${path}`);
          });
        });
        const seqRes = await fetch('/docs/qa/sequence/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoints, spec_json: JSON.stringify(spec) }),
        });
        const data = await seqRes.json();
        if (!seqRes.ok) throw new Error(data.error || 'AI sequencing failed');
        setSequenceAnalysis({
          summary: data.summary,
          phases: data.phases,
          steps: data.steps,
          notes: data.notes,
          model_used: data.model_used,
        });
      } else {
        const seqRes = await fetch('/docs/qa/sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spec),
        });
        if (seqRes.ok) setSequenceAnalysis(await seqRes.json());
      }
    } catch (e: any) {
      setSequenceError(e.message || 'Failed to analyze sequence');
      if (mode === 'ai') {
        try {
          const specRes = await fetch('/docs/swagger.json');
          const spec = await specRes.json();
          const seqRes = await fetch('/docs/qa/sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(spec),
          });
          if (seqRes.ok) {
            setSequenceAnalysis(await seqRes.json());
            setSequenceSource('standards');
          }
        } catch { }
      }
    }
    setSequenceLoading(false);
  };

  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    const p = AI_PROVIDERS.find((item) => item.id === providerId);
    if (p) setSelectedModel(p.defaultModel);
    setIsDropdownOpen(false);
  };

  const handleUpdateKey = (provider: string, key: string) => {
    const next = { ...providerKeys, [provider]: key };
    setProviderKeys(next);
    try {
      localStorage.setItem('apidocs_ai_keys', JSON.stringify(next));
    } catch { }
  };

  const handleUpdateBaseUrl = (provider: string, url: string) => {
    const next = { ...customBaseUrls, [provider]: url };
    setCustomBaseUrls(next);
    try {
      localStorage.setItem('apidocs_ai_base_urls', JSON.stringify(next));
    } catch { }
  };

  /* ---- Progress messages ---- */
  const startProgressMessages = () => {
    const messages = [
      'Analyzing OpenAPI specification…',
      'Extracting schemas and constraints…',
      'Synthesizing happy-path cases…',
      'Adding boundary and edge probes…',
      'Generating negative and security cases…',
      'Compiling assertions and expected values…',
    ];
    let idx = 0;
    setProgressMessage(messages[0]);
    progressTimerRef.current = window.setInterval(() => {
      idx = Math.min(idx + 1, messages.length - 1);
      setProgressMessage(messages[idx]);
    }, 2200);
  };
  const stopProgressMessages = () => {
    if (progressTimerRef.current !== null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgressMessage('');
  };

  /* ---- Handle generate with cancel + retry + fallback ---- */
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setExecutionResults({});
    startProgressMessages();

    const controller = new AbortController();
    generateAbortRef.current = controller;

    const attempt = async (modelToUse: string, retryCount = 0): Promise<any> => {
      const res = await fetch('/docs/qa/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: controller.signal,
        body: JSON.stringify({
          provider: selectedProvider,
          model: modelToUse,
          endpoint_key: endpointKey,
          custom_prompt: customPrompt,
          api_key: providerKeys[selectedProvider] || '',
          base_url: customBaseUrls[selectedProvider] || '',
        }),
      });

      // Retry on 429/503 with backoff
      if ((res.status === 429 || res.status === 503) && retryCount < 2) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retryCount)));
        return attempt(modelToUse, retryCount + 1);
      }

      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Failed to generate AI test cases') as any;
        err.status = res.status;
        throw err;
      }
      return data;
    };

    try {
      let data;
      try {
        data = await attempt(selectedModel);
      } catch (e: any) {
        // If 404 model-not-found, try next model in same provider
        if (e.status === 404 && activeProvider.models.length > 1) {
          const nextModel = activeProvider.models.find((m) => m.id !== selectedModel);
          if (nextModel) {
            setSelectedModel(nextModel.id);
            data = await attempt(nextModel.id);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

      setSuite(data.suite);
      if (data.suite?.test_cases?.length > 0) {
        setSelectedTestCase(data.suite.test_cases[0]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Generation cancelled.');
      } else {
        setError(err.message || 'Error communicating with AI test synthesis service');
      }
    } finally {
      stopProgressMessages();
      setLoading(false);
      generateAbortRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
    }
  };

  /* ---- Single test run (preserved) ---- */
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

      const options: RequestInit = { method: tc.method || 'GET', headers };

      if (['POST', 'PUT', 'PATCH'].includes(tc.method.toUpperCase()) && tc.request_body) {
        options.body =
          typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
      }

      const response = await fetch(targetUrl, options);
      const durationMs = Math.round(performance.now() - startTime);

      let responseBody = '';
      try {
        responseBody = await response.clone().text();
      } catch { }

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
          responseBody,
          errorMessage: statusMatches
            ? undefined
            : `Expected status ${tc.expected_status}, received ${response.status}`,
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

  /* ---- Backend execution ---- */
  const runSuitesOnBackend = async (suites: Record<string, AITestSuite>) => {
    const res = await fetch('/docs/qa/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suites }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'execution failed');
    return data as {
      results: Record<string, any[]>;
      summary: Record<string, { total: number; passed: number; failed: number; avg_latency_ms: number }>;
    };
  };

  const convertBackendResults = (backend: any[]): Record<string, TestExecutionResult> => {
    const out: Record<string, TestExecutionResult> = {};
    (backend || []).forEach((r: any) => {
      out[r.test_case_id] = {
        testId: r.test_case_id,
        status: r.passed ? 'passed' : 'failed',
        actualStatus: r.actual_status,
        durationMs: r.duration_ms,
        assertionsPassed: (r.assertion_checks || []).filter((c: any) => c.passed).length,
        assertionsTotal: (r.assertion_checks || []).length || 1,
        errorMessage:
          r.error_message ||
          (r.passed ? undefined : (r.assertion_checks || []).find((c: any) => !c.passed)?.detail),
      };
    });
    return out;
  };

  /* ---- Run selected / run all (server-side) ---- */
  const handleRunSelectedTests = async () => {
    if (!suite?.test_cases?.length) return;
    const targets = suite.test_cases.filter((tc) => selectedTestIds.has(tc.id));
    const casesToRun = targets.length > 0 ? targets : suite.test_cases;
    setRunningTests(true);

    try {
      const scoped: AITestSuite = { ...suite, test_cases: casesToRun };
      const data = await runSuitesOnBackend({ [endpointKey]: scoped });
      const epResults = convertBackendResults(data.results[endpointKey] || []);
      setExecutionResults((prev) => ({ ...prev, ...epResults }));
      lastRunResultsRef.current = epResults;

      const total = casesToRun.length;
      let passed = 0;
      let failed = 0;
      let latencySum = 0;
      casesToRun.forEach((tc) => {
        const res = epResults[tc.id];
        if (res?.status === 'passed') passed++;
        else if (res?.status === 'failed') failed++;
        latencySum += res?.durationMs || 0;
      });
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      const avgLatency = total > 0 ? Math.round(latencySum / total) : 0;
      const scope =
        targets.length > 0
          ? `selected subset (${targets.length}/${suite.test_cases.length} cases)`
          : 'full suite';
      const overallStatus = passed === total && total > 0 ? 'passed' : failed > 0 ? 'failed' : 'retest';

      try {
        await fetch('/docs/qa/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint_key: endpointKey,
            status: overallStatus,
            tester: `AI QA Runner (${suite.model_used || selectedProvider})`,
            comment: `Server-side AI Test Run [${scope}]: ${passed}/${total} passed (${passRate}%).`,
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
      } catch { }
    } catch (e: any) {
      setError('Server-side execution failed: ' + (e.message || 'unknown error'));
    } finally {
      setRunningTests(false);
    }
  };

  /* ---- Regenerate failed only ---- */
  const handleRegenerateFailed = async () => {
    if (!suite) return;
    const failedTests = suite.test_cases.filter((tc) => executionResults[tc.id]?.status === 'failed');
    if (failedTests.length === 0) return;
    setSelectedTestIds(new Set(failedTests.map((tc) => tc.id)));
    // Trigger the parent regenerate flow; the parent will normally re-synthesize all
    // cases for the endpoint, so set the message accordingly.
    await handleGenerate();
  };

  /* ---- Copy test as cURL ---- */
  const buildCurl = (tc: AITestCase): string => {
    const base = window.location.origin;
    let url = `${base}${tc.path}`;
    if (tc.query_params && Object.keys(tc.query_params).length > 0) {
      url += '?' + new URLSearchParams(tc.query_params).toString();
    }
    const lines = [`curl -X ${tc.method.toUpperCase()} "${url}"`];
    lines.push(`  -H "Content-Type: application/json"`);
    if (tc.headers) {
      Object.entries(tc.headers).forEach(([k, v]) => {
        lines.push(`  -H "${k}: ${v}"`);
      });
    }
    if (['POST', 'PUT', 'PATCH'].includes(tc.method.toUpperCase()) && tc.request_body) {
      const body = typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
      lines.push(`  -d '${body}'`);
    }
    return lines.join(' \\\n');
  };

  /* ---- Reports ---- */
  const buildReportPayload = () => {
    const results =
      suite?.test_cases.map((tc) => ({
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
      lines.push(
        `| ${i + 1} | ${tc.name} | ${tc.category} | ${tc.expected_status} | ${actual} | ${icon} ${status} | ${dur} |`,
      );
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
      downloadFile(
        `ai-test-report-${safeFileStamp()}.json`,
        JSON.stringify(buildReportPayload(), null, 2),
        'application/json',
      );
    } else {
      downloadFile(`ai-test-report-${safeFileStamp()}.md`, buildMarkdownReport(), 'text/markdown');
    }
    setReportSavedAt(new Date().toISOString());
  };

  const handleSaveToServer = async () => {
    const payload = buildReportPayload();
    const title = `${endpointKey} — ${new Date().toLocaleString()}`;
    try {
      const res = await fetch('/docs/qa/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          endpoint_key: endpointKey,
          provider: payload.provider,
          model: payload.model,
          suites: { [endpointKey]: suite },
          results: {
            [endpointKey]: Object.values(executionResults).map((r) => ({
              test_case_id: r.testId,
              passed: r.status === 'passed',
              actual_status: r.actualStatus ?? 0,
              duration_ms: r.durationMs ?? 0,
              error_message: r.errorMessage,
            })),
          },
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setReportSavedAt(new Date().toISOString());
    } catch (e: any) {
      setError('Failed to save report: ' + e.message);
    }
  };

  /* ---- Batch ---- */
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
              const opts: RequestInit = {
                method: tc.method || 'GET',
                headers: { 'Content-Type': 'application/json', ...(tc.headers || {}) },
              };
              if (['POST', 'PUT', 'PATCH'].includes((tc.method || 'GET').toUpperCase()) && tc.request_body) {
                opts.body = typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
              }
              const resp = await fetch(url, opts);
              actual = resp.status;
              status = resp.status === tc.expected_status ? 'passed' : 'failed';
            } catch {
              status = 'failed';
            }
            epResults[tc.id] = {
              testId: tc.id,
              status,
              actualStatus: actual,
              durationMs: Math.round(performance.now() - start),
              assertionsPassed: status === 'passed' ? tc.assertions?.length || 1 : 0,
              assertionsTotal: tc.assertions?.length || 1,
              errorMessage:
                status === 'failed' && actual != null
                  ? `Expected ${tc.expected_status}, received ${actual}`
                  : 'Network invocation failed',
            };
          }
          results[ep] = epResults;

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
          } catch { }
        }
      } catch (e: any) {
        suites[ep] = {
          endpoint_key: ep,
          summary: `Generation failed: ${e.message}`,
          model_used: selectedModel,
          generated_at: new Date().toISOString(),
          test_cases: [],
        };
      }
    }

    setBatchSuites(suites);
    setBatchResults(results);
    setBatchProgress({ current: '', done: targets.length, total: targets.length });
    const lastEp = [...targets].reverse().find((ep) => suites[ep]?.test_cases?.length > 0);
    if (lastEp) {
      setActiveEndpointView(lastEp);
      setSuite(suites[lastEp]);
      setSelectedTestCase(suites[lastEp].test_cases[0] || null);
      setExecutionResults(results[lastEp] || {});
    }
  };

  /* ---- Stress ---- */
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
          const options: RequestInit = { method: tc.method || 'GET', headers };
          if (['POST', 'PUT', 'PATCH'].includes(tc.method.toUpperCase()) && tc.request_body) {
            options.body =
              typeof tc.request_body === 'string' ? tc.request_body : JSON.stringify(tc.request_body);
          }
          const res = await fetch(targetUrl, options);
          const reqDuration = Math.round(performance.now() - reqStart);
          latencies.push(reqDuration);
          completedCount++;
          if (res.status === 429) rateLimitedCount++;
          else if (res.status === tc.expected_status || (res.status >= 200 && res.status < 400))
            successfulCount++;
          else failedCount++;
        } catch {
          failedCount++;
          completedCount++;
        }

        const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
        setStressMetrics({
          completed: completedCount,
          successful: successfulCount,
          failed: failedCount,
          rateLimited: rateLimitedCount,
          rps: Math.round((completedCount / elapsedSec) * 10) / 10,
          avgLatencyMs:
            latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
          p95LatencyMs:
            latencies.length > 0
              ? [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] || 0
              : 0,
          durationMs: Math.round(performance.now() - startTime),
        });
      }
    };

    const activeWorkers = Array.from(
      { length: Math.min(concurrencyLevel, totalRequestsTarget) },
      () => worker(),
    );
    await Promise.allSettled(activeWorkers);

    const totalElapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
    latencies.sort((a, b) => a - b);
    const finalMetrics = {
      completed: completedCount,
      successful: successfulCount,
      failed: failedCount,
      rateLimited: rateLimitedCount,
      rps: Math.round((completedCount / totalElapsedSec) * 10) / 10,
      avgLatencyMs:
        latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p95LatencyMs:
        latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || 0 : 0,
      durationMs: Math.round(performance.now() - startTime),
    };
    setStressMetrics(finalMetrics);

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
    } catch { }

    setRunningStress(false);
  };

  /* ---- k6/Locust export ---- */
  const generateK6Script = (): string => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return '';
    const origin = window.location.origin;
    const casesCode = suite.test_cases
      .map((tc, idx) => {
        let url = `${origin}${tc.path}`;
        if (tc.query_params && Object.keys(tc.query_params).length > 0) {
          url += '?' + new URLSearchParams(tc.query_params).toString();
        }
        const headers = JSON.stringify(
          { 'Content-Type': 'application/json', ...(tc.headers || {}) },
          null,
          4,
        );
        const body = tc.request_body ? `JSON.stringify(${JSON.stringify(tc.request_body)})` : 'null';
        return `  // Scenario ${idx + 1}: ${tc.name} (${tc.category})
  {
    const res = http.${tc.method.toLowerCase()}('${url}', ${body}, { headers: ${headers} });
    check(res, {
      'status is ${tc.expected_status}': (r) => r.status === ${tc.expected_status},
    });
    sleep(0.05);
  }`;
      })
      .join('\n\n');

    return `import http from 'k6/http';
import { check, sleep } from 'k6';

// Automated k6 Performance & Stress Script for: ${endpointKey}
// Generated via go-apidocs AI Inference Engine (${suite.model_used})
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
${casesCode}
}
`;
  };

  const generateLocustScript = (): string => {
    if (!suite?.test_cases || suite.test_cases.length === 0) return '';
    const tasks = suite.test_cases
      .map((tc, idx) => {
        let path = tc.path;
        if (tc.query_params && Object.keys(tc.query_params).length > 0) {
          path += '?' + new URLSearchParams(tc.query_params).toString();
        }
        const headers = JSON.stringify({ 'Content-Type': 'application/json', ...(tc.headers || {}) });
        const jsonPayload = tc.request_body ? `, json=${JSON.stringify(tc.request_body)}` : '';
        return `    @task
    def scenario_${idx + 1}_${tc.id.replace(/[^a-zA-Z0-9_]/g, '_')}(self):
        """${tc.name} - ${tc.category}"""
        with self.client.${tc.method.toLowerCase()}("${path}", headers=${headers}${jsonPayload}, catch_response=True) as res:
            if res.status_code == ${tc.expected_status}:
                res.success()
            else:
                res.failure(f"Expected ${tc.expected_status}, got {res.status_code}")`;
      })
      .join('\n\n');

    return `from locust import HttpUser, task, between

# Automated Locust Stress & Concurrency Test for: ${endpointKey}
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

  /* ---- Derived ---- */
  const categories = suite?.test_cases
    ? ['all', ...Array.from(new Set(suite.test_cases.map((t) => t.category)))]
    : ['all'];

  const filteredTests =
    suite?.test_cases.filter((tc) => activeCategory === 'all' || tc.category === activeCategory) || [];

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

  const failedCount = Object.values(executionResults).filter((r) => r.status === 'failed').length;

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (!loading) handleGenerate();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!runningTests && suite?.test_cases?.length) {
          if (e.shiftKey) {
            // ⌘⇧↵ — run selected
            handleRunSelectedTests();
          } else {
            handleRunSelectedTests();
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, loading, runningTests, suite, selectedTestIds]);

  if (!isOpen || !endpointKey) return null;

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      widthClass="max-w-5xl"
      hideHeader={true}
    >
      <div className="flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* ---- Custom dark command bar header ---- */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={{
            background: 'var(--bg-canvas)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-9 h-9 rounded-[var(--r-md)] grid place-items-center shrink-0"
            style={{
              background: 'linear-gradient(145deg, var(--accent-400), var(--accent-500))',
              color: '#04161C',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px color-mix(in srgb, var(--accent-500) 30%, transparent)',
            }}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                AI Test Suite & Execution Runner
              </h2>
              <span
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded mono text-[10.5px] font-medium"
                style={{
                  background: 'var(--accent-muted)',
                  color: 'var(--accent-500)',
                  border: '1px solid color-mix(in srgb, var(--accent-500) 22%, transparent)',
                }}
              >
                <Cpu className="w-3 h-3" />
                {suite?.model_used || activeProvider.name}
              </span>
            </div>
            <div className="text-[11.5px] mono mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--success-500)', boxShadow: '0 0 6px var(--success-500)' }}
              />
              <span>Target:</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{endpointKey}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-7 h-7 rounded-[var(--r-sm)] shrink-0 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ---- Body ---- */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ background: 'var(--bg-canvas)' }}>
          {/* ---- Provider / model / settings panel ---- */}
          <div
            className="p-4 rounded-[var(--r-md)] space-y-4 relative z-20"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            {/* ---- Compact model picker + generate ---- */}
            <div
              className="p-3 rounded-[var(--r-md)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              {/* Row 1: model + gear */}
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span
                  className="text-[11px] font-semibold uppercase shrink-0"
                  style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                >
                  Model
                </span>
                <div className="relative flex-1 min-w-0">
                  <select
                    value={`${selectedProvider}|${selectedModel}`}
                    onChange={(e) => {
                      const [p, m] = e.target.value.split('|');
                      setSelectedProvider(p);
                      setSelectedModel(m);
                    }}
                    className="w-full h-8 px-2.5 pr-7 rounded-[var(--r-sm)] text-[12.5px] font-medium outline-none cursor-pointer appearance-none"
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {AI_PROVIDERS.map((prov) => (
                      <optgroup
                        key={prov.id}
                        label={`${prov.name}${providerKeys[prov.id] ? ' ✓' : ''}`}
                      >
                        {prov.models.map((m) => (
                          <option key={`${prov.id}|${m.id}`} value={`${prov.id}|${m.id}`}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCredentialsModal(true)}
                  className="grid place-items-center w-8 h-8 rounded-[var(--r-sm)] shrink-0 transition-colors"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: providerKeys[selectedProvider] ? 'var(--success-500)' : 'var(--text-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-canvas)';
                  }}
                  title={
                    providerKeys[selectedProvider]
                      ? `${activeProvider.name} credentials configured — click to manage`
                      : 'Configure API credentials'
                  }
                >
                  {providerKeys[selectedProvider] ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Settings2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Row 2: prompt + generate */}
              <div className="flex gap-2 mt-2.5">
                <input
                  type="text"
                  placeholder="Optional prompt tweak (e.g. 'Emphasize SQLi and JWT checks')…"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-[var(--r-sm)] outline-none text-[12px]"
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
                {loading ? (
                  <>
                    <div
                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] text-[11.5px] shrink-0"
                      style={{
                        background: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--accent-500)' }} />
                      <span className="max-w-[160px] truncate">{progressMessage || 'Working…'}</span>
                    </div>
                    <button
                      onClick={handleCancelGeneration}
                      className="h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium inline-flex items-center gap-1 shrink-0"
                      style={{
                        background: 'transparent',
                        border: '1px solid color-mix(in srgb, var(--danger-500) 30%, transparent)',
                        color: 'var(--danger-500)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-500) 8%, transparent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Ban className="w-3 h-3" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <PrimaryBtn onClick={handleGenerate} Icon={Sparkles} title="Generate (⌘G)">
                    {suite ? 'Regenerate' : 'Synthesize'}
                  </PrimaryBtn>
                )}
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-2 p-2.5 mt-2.5 rounded-[var(--r-sm)] text-[11.5px]"
                  style={{
                    background: 'color-mix(in srgb, var(--danger-500) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--danger-500) 24%, transparent)',
                    color: 'var(--danger-500)',
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{categorizeError(error).category}</div>
                    <div className="mt-0.5 leading-relaxed opacity-90">{categorizeError(error).hint}</div>
                  </div>
                </div>
              )}

              {/* Batch runner — collapsed by default */}
              {endpointsList.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => setShowBatchPanel(!showBatchPanel)}
                    className="w-full flex items-center gap-1.5 h-6 text-[11.5px] font-medium transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Multi-endpoint batch</span>
                    <span
                      className="mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bg-overlay)', color: 'var(--text-tertiary)' }}
                    >
                      {targetEndpoints.size}
                    </span>
                    <ChevronDown
                      className="w-3 h-3 ml-auto transition-transform"
                      style={{ transform: showBatchPanel ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>

                  {showBatchPanel && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <label
                          className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 cursor-pointer"
                            style={{ accentColor: 'var(--accent-500)' }}
                            checked={batchAutoRun}
                            onChange={(e) => setBatchAutoRun(e.target.checked)}
                          />
                          Execute after generating
                        </label>
                        <GhostBtn onClick={() => setShowEndpointPicker(!showEndpointPicker)} Icon={CheckCheck}>
                          Choose endpoints
                        </GhostBtn>
                        <GhostBtn
                          onClick={handleRunBatch}
                          disabled={batchProgress !== null && batchProgress.done < batchProgress.total}
                          Icon={Play}
                        >
                          {batchProgress && batchProgress.done < batchProgress.total
                            ? `Batch ${batchProgress.done + 1}/${batchProgress.total}…`
                            : `Run batch (${targetEndpoints.size})`}
                        </GhostBtn>
                      </div>

                      {showEndpointPicker && (
                        <div
                          className="p-2.5 rounded-[var(--r-sm)] space-y-2"
                          style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] font-semibold uppercase"
                              style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                            >
                              Endpoints in batch
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setTargetEndpoints(new Set(endpointsList))}
                                className="text-[10.5px] font-medium px-1.5 py-0.5 rounded transition-colors"
                                style={{ color: 'var(--accent-500)' }}
                              >
                                All
                              </button>
                              <button
                                onClick={() => setTargetEndpoints(new Set())}
                                className="text-[10.5px] font-medium px-1.5 py-0.5 rounded transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                None
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 max-h-52 overflow-y-auto">
                            {endpointsList.map((ep) => (
                              <label
                                key={ep}
                                className="flex items-center gap-1.5 p-1.5 rounded cursor-pointer select-none text-[11px]"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="w-3.5 h-3.5 cursor-pointer"
                                  style={{ accentColor: 'var(--accent-500)' }}
                                  checked={targetEndpoints.has(ep)}
                                  onChange={() => handleToggleTargetEndpoint(ep)}
                                />
                                <span className="mono truncate" title={ep}>
                                  {ep}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {batchProgress &&
                        batchProgress.done >= batchProgress.total &&
                        Object.keys(batchSuites).length > 0 && (
                          <div className="space-y-2">
                            <div
                              className="text-[10px] font-semibold uppercase"
                              style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                            >
                              Batch results — click to inspect
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
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-sm)] mono text-[10.5px] font-medium transition-colors"
                                    style={
                                      ok
                                        ? {
                                          background: 'color-mix(in srgb, var(--success-500) 10%, transparent)',
                                          color: 'var(--success-500)',
                                          border: '1px solid color-mix(in srgb, var(--success-500) 24%, transparent)',
                                        }
                                        : total === 0
                                          ? {
                                            background: 'var(--bg-overlay)',
                                            color: 'var(--text-tertiary)',
                                            border: '1px solid var(--border-subtle)',
                                          }
                                          : {
                                            background: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
                                            color: 'var(--danger-500)',
                                            border: '1px solid color-mix(in srgb, var(--danger-500) 24%, transparent)',
                                          }
                                    }
                                    title={`${ep}: ${passed}/${total}`}
                                  >
                                    {ep} {total > 0 ? `(${passed}/${total})` : '(failed)'}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                downloadFile(
                                  `ai-batch-report-${new Date().toISOString().slice(0, 10)}.json`,
                                  JSON.stringify(
                                    {
                                      generated_at: new Date().toISOString(),
                                      provider: selectedProvider,
                                      model: selectedModel,
                                      endpoints: batchSuites,
                                      results: batchResults,
                                    },
                                    null,
                                    2,
                                  ),
                                  'application/json',
                                )
                              }
                              className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--r-sm)] text-[11px] font-medium transition-colors"
                              style={{
                                background: 'var(--bg-canvas)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <Download className="w-3 h-3" />
                              Save batch report
                            </button>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* ---- Test suite ---- */}
          {suite && (
            <>
              {/* Summary + actions bar */}
              <div
                className="p-4 rounded-[var(--r-md)] flex flex-col md:flex-row md:items-center justify-between gap-3"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-500)' }} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Test strategy & coverage summary
                    </div>
                    <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {suite.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {/* Save report */}
                  <div
                    className="inline-flex rounded-[var(--r-sm)] overflow-hidden"
                    style={{ border: '1px solid var(--border-default)' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSaveReport('markdown')}
                      className="inline-flex items-center gap-1 h-7 px-2 text-[11px] font-medium transition-colors"
                      style={{ background: 'var(--bg-canvas)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border-default)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      title="Download as Markdown"
                    >
                      <Download className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToServer}
                      className="inline-flex items-center h-7 px-2 text-[10.5px] font-semibold transition-colors"
                      style={{ background: 'var(--bg-canvas)', color: 'var(--accent-500)', borderRight: '1px solid var(--border-default)' }}
                      title="Save to server"
                    >
                      SAVE
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveReport('json')}
                      className="inline-flex items-center h-7 px-2 mono text-[10.5px] font-medium transition-colors"
                      style={{ background: 'var(--bg-canvas)', color: 'var(--text-tertiary)' }}
                      title="Download as JSON"
                    >
                      JSON
                    </button>
                  </div>
                  {reportSavedAt && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: 'var(--success-500)' }}>
                      <CheckCircle2 className="w-3 h-3" /> Saved
                    </span>
                  )}

                  <GhostBtn onClick={() => setShowExportModal(true)} Icon={Download}>k6/Locust</GhostBtn>
                  <GhostBtn onClick={() => setShowStressRunner(!showStressRunner)} Icon={Gauge}>
                    Stress
                  </GhostBtn>
                  <GhostBtn
                    onClick={async () => {
                      setShowSequencePanel(!showSequencePanel);
                      if (!sequenceAnalysis && !sequenceLoading) await fetchSequence('standards');
                    }}
                    Icon={GitBranch}
                  >
                    Sequence
                  </GhostBtn>

                  <PrimaryBtn
                    onClick={handleRunSelectedTests}
                    disabled={runningTests || runningStress}
                    Icon={Play}
                    title="Run (⌘↵)"
                  >
                    {runningTests
                      ? 'Running…'
                      : selectedTestIds.size > 0
                        ? `Run selected (${selectedTestIds.size})`
                        : 'Run all'}
                  </PrimaryBtn>

                  {failedCount > 0 && (
                    <GhostBtn onClick={handleRegenerateFailed} Icon={RefreshCw}>
                      Regenerate {failedCount} failed
                    </GhostBtn>
                  )}
                </div>
              </div>

              {/* Stress runner */}
              {showStressRunner && (
                <div
                  className="p-4 rounded-[var(--r-md)] space-y-3"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4" style={{ color: 'var(--warning-500)' }} />
                      <div>
                        <div className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          Concurrent stress simulator
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          Concurrent worker pool to evaluate throughput, P95 latency, and rate limits.
                        </p>
                      </div>
                    </div>
                    <PrimaryBtn
                      onClick={handleRunConcurrentStress}
                      disabled={runningStress || runningTests}
                      Icon={Zap}
                    >
                      {runningStress ? 'Running…' : 'Start'}
                    </PrimaryBtn>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Parallel workers"
                      right={
                        <span className="mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {concurrencyLevel}x
                        </span>
                      }
                    >
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={concurrencyLevel}
                        disabled={runningStress}
                        onChange={(e) => setConcurrencyLevel(parseInt(e.target.value, 10))}
                        className="w-full cursor-pointer"
                        style={{ accentColor: 'var(--accent-500)' }}
                      />
                    </Field>
                    <Field
                      label="Total requests"
                      right={
                        <span className="mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {totalRequestsTarget}
                        </span>
                      }
                    >
                      <input
                        type="range"
                        min="5"
                        max="200"
                        step="5"
                        value={totalRequestsTarget}
                        disabled={runningStress}
                        onChange={(e) => setTotalRequestsTarget(parseInt(e.target.value, 10))}
                        className="w-full cursor-pointer"
                        style={{ accentColor: 'var(--accent-500)' }}
                      />
                    </Field>
                  </div>

                  {stressMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Throughput', value: `${stressMetrics.rps}`, suffix: 'req/s' },
                        { label: 'P95 latency', value: `${stressMetrics.p95LatencyMs}`, suffix: 'ms' },
                        { label: 'Avg latency', value: `${stressMetrics.avgLatencyMs}`, suffix: 'ms' },
                        { label: 'Success / 429', value: `${stressMetrics.successful}/${stressMetrics.rateLimited}`, suffix: '' },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className="p-2 rounded-[var(--r-sm)]"
                          style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                            {m.label}
                          </div>
                          <div className="mono text-[14px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {m.value}
                            {m.suffix && <span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-tertiary)' }}>{m.suffix}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sequence */}
              {showSequencePanel && (
                <div
                  className="p-4 rounded-[var(--r-md)] space-y-3"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4" style={{ color: 'var(--accent-500)' }} />
                      <div>
                        <div className="text-[12.5px] font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                          {sequenceSource === 'ai' ? 'AI-suggested workflow' : 'Recommended sequence'}
                          <span
                            className="mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg-overlay)', color: 'var(--text-tertiary)' }}
                          >
                            {sequenceSource === 'ai' ? 'AI' : 'REST standards'}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {sequenceAnalysis?.summary || 'Analyzing spec for dependency-aware order…'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <GhostBtn onClick={() => fetchSequence('standards')} disabled={sequenceLoading}>Standards</GhostBtn>
                      <GhostBtn onClick={() => fetchSequence('ai')} disabled={sequenceLoading} Icon={Sparkles}>AI workflow</GhostBtn>
                      {sequenceLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
                    </div>
                  </div>
                  {sequenceError && (
                    <div
                      className="text-[11px] p-2 rounded"
                      style={{
                        background: 'color-mix(in srgb, var(--warning-500) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--warning-500) 22%, transparent)',
                        color: 'var(--warning-500)',
                      }}
                    >
                      {sequenceError} — showing standards ordering.
                    </div>
                  )}
                  {sequenceAnalysis?.steps && (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {sequenceAnalysis.phases.map((p: string) => (
                          <span
                            key={p}
                            className="pill pill--accent"
                            style={{ height: 18, fontSize: 10, padding: '0 5px' }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {sequenceAnalysis.steps.map((s: any) => (
                          <div
                            key={s.endpoint_key}
                            className="flex items-start gap-2 p-2 rounded-[var(--r-sm)]"
                            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
                          >
                            <span
                              className="shrink-0 w-5 h-5 rounded mono text-[10px] font-semibold grid place-items-center"
                              style={{ background: 'var(--accent-muted)', color: 'var(--accent-500)' }}
                            >
                              {s.order}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mono text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {s.endpoint_key}
                              </div>
                              <div className="text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                {s.reason}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <SavedReportsPanel
                onOpenReport={(rep) => {
                  const ep = Object.keys(rep.suites || {})[0] || rep.endpoint_key;
                  if (rep.suites?.[ep]) {
                    setActiveEndpointView(ep);
                    setSuite(rep.suites[ep]);
                    setSelectedTestCase(rep.suites[ep].test_cases?.[0] || null);
                    setExecutionResults({});
                  }
                }}
              />

              {/* Category chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <label
                  className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--r-sm)] text-[11.5px] font-medium cursor-pointer shrink-0 select-none"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 cursor-pointer"
                    style={{ accentColor: 'var(--accent-500)' }}
                    checked={filteredTests.length > 0 && filteredTests.every((tc) => selectedTestIds.has(tc.id))}
                    onChange={handleSelectAllTests}
                  />
                  Select all
                </label>
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className="h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium whitespace-nowrap transition-colors shrink-0"
                      style={
                        isActive
                          ? { background: 'var(--accent-500)', color: 'var(--text-inverse)' }
                          : {
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }
                      }
                    >
                      {cat === 'all' ? 'All cases' : cat}
                    </button>
                  );
                })}
              </div>

              {/* Split: list + detail */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Test list */}
                <div className="lg:col-span-5 space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                  {filteredTests.map((tc) => {
                    const isSelected = selectedTestCase?.id === tc.id;
                    const runRes = executionResults[tc.id];
                    const isChecked = selectedTestIds.has(tc.id);
                    const tone = categoryTone(tc.category);
                    return (
                      <div
                        key={tc.id}
                        onClick={() => setSelectedTestCase(tc)}
                        className="p-3 rounded-[var(--r-sm)] border cursor-pointer transition-all"
                        style={{
                          background: 'var(--bg-surface)',
                          borderColor: isSelected
                            ? 'var(--accent-500)'
                            : 'var(--border-subtle)',
                          boxShadow: isSelected
                            ? '0 0 0 3px var(--accent-muted)'
                            : 'var(--shadow-xs)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 cursor-pointer"
                            style={{ accentColor: 'var(--accent-500)' }}
                            checked={isChecked}
                            onChange={() => handleToggleTestSelected(tc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span
                            className="pill shrink-0"
                            style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}
                          >
                            {tc.category}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {runRes?.status === 'running' && (
                              <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--accent-500)' }} />
                            )}
                            {runRes?.status === 'passed' && (
                              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success-500)' }} />
                            )}
                            {runRes?.status === 'failed' && (
                              <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--danger-500)' }} />
                            )}
                            <span className="mono text-[10px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                              {tc.expected_status}
                            </span>
                          </div>
                        </div>
                        <div className="text-[12px] font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                          {tc.name}
                        </div>
                        <div className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                          {tc.description}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail */}
                <div
                  className="lg:col-span-7 rounded-[var(--r-md)] p-4 space-y-3"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  {selectedTestCase ? (
                    <>
                      <div className="flex items-start justify-between gap-2 pb-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {selectedTestCase.name}
                          </div>
                          <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                            {selectedTestCase.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <GhostBtn onClick={() => handleCopy(buildCurl(selectedTestCase), 'curl-' + selectedTestCase.id)} Icon={copiedId === 'curl-' + selectedTestCase.id ? Check : Copy}>
                            cURL
                          </GhostBtn>
                          <PrimaryBtn onClick={() => handleRunSingleTest(selectedTestCase)} Icon={Play}>
                            Run
                          </PrimaryBtn>
                          {onLoadIntoSandbox && (
                            <GhostBtn
                              onClick={() => {
                                onLoadIntoSandbox(selectedTestCase);
                                onClose();
                              }}
                              Icon={Terminal}
                            >
                              Sandbox
                            </GhostBtn>
                          )}
                        </div>
                      </div>

                      {/* Run result with diff */}
                      {executionResults[selectedTestCase.id] && (
                        <div
                          className="p-3 rounded-[var(--r-sm)] text-[11.5px] space-y-2"
                          style={{
                            background:
                              executionResults[selectedTestCase.id].status === 'passed'
                                ? 'color-mix(in srgb, var(--success-500) 8%, transparent)'
                                : executionResults[selectedTestCase.id].status === 'failed'
                                  ? 'color-mix(in srgb, var(--danger-500) 8%, transparent)'
                                  : 'var(--bg-canvas)',
                            border: `1px solid ${executionResults[selectedTestCase.id].status === 'passed'
                              ? 'color-mix(in srgb, var(--success-500) 24%, transparent)'
                              : executionResults[selectedTestCase.id].status === 'failed'
                                ? 'color-mix(in srgb, var(--danger-500) 24%, transparent)'
                                : 'var(--border-subtle)'
                              }`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {executionResults[selectedTestCase.id].status === 'passed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success-500)' }} />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--danger-500)' }} />
                              )}
                              <strong style={{ color: 'var(--text-primary)' }} className="capitalize">
                                {executionResults[selectedTestCase.id].status}
                              </strong>
                              <span className="mono" style={{ color: 'var(--text-tertiary)' }}>
                                · {executionResults[selectedTestCase.id].durationMs}ms
                              </span>
                            </div>
                            <span className="mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                              {executionResults[selectedTestCase.id].assertionsPassed}/{executionResults[selectedTestCase.id].assertionsTotal} assertions
                            </span>
                          </div>

                          {executionResults[selectedTestCase.id].status === 'failed' && (
                            <div className="grid grid-cols-2 gap-2 mono text-[11px]">
                              <div
                                className="p-1.5 rounded"
                                style={{
                                  background: 'color-mix(in srgb, var(--danger-500) 6%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--danger-500) 18%, transparent)',
                                }}
                              >
                                <div className="text-[9.5px] uppercase mb-0.5" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                                  Expected
                                </div>
                                <div style={{ color: 'var(--text-primary)' }}>{selectedTestCase.expected_status}</div>
                              </div>
                              <div
                                className="p-1.5 rounded"
                                style={{
                                  background: 'color-mix(in srgb, var(--danger-500) 6%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--danger-500) 18%, transparent)',
                                }}
                              >
                                <div className="text-[9.5px] uppercase mb-0.5" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                                  Actual
                                </div>
                                <div style={{ color: 'var(--danger-500)' }}>
                                  {executionResults[selectedTestCase.id].actualStatus ?? '—'}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Request body */}
                      {selectedTestCase.request_body && (
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
                            <span style={{ color: 'var(--text-secondary)' }}>Request body</span>
                            <button
                              onClick={() =>
                                handleCopy(JSON.stringify(selectedTestCase.request_body, null, 2), 'body')
                              }
                              className="inline-flex items-center gap-1 text-[10.5px] font-mono transition-colors"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              {copiedId === 'body' ? (
                                <Check className="w-3 h-3" style={{ color: 'var(--success-500)' }} />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              {copiedId === 'body' ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <pre
                            className="p-2.5 rounded-[var(--r-sm)] mono text-[11px] overflow-x-auto max-h-40"
                            style={{
                              background: 'var(--bg-canvas)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              margin: 0,
                            }}
                          >
                            {JSON.stringify(selectedTestCase.request_body, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Assertions */}
                      {selectedTestCase.assertions && selectedTestCase.assertions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Assertions
                          </div>
                          <ul className="space-y-1">
                            {selectedTestCase.assertions.map((ast, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-1.5 p-1.5 rounded mono text-[11px]"
                                style={{
                                  background: 'var(--bg-canvas)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: 'var(--success-500)' }} />
                                <span className="truncate">{ast}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-16 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Select a test case to inspect and run.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---- Footer ---- */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}
        >
          <div className="text-[11px] mono flex items-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
            <span><span className="kbd">⌘G</span> generate</span>
            <span><span className="kbd">⌘↵</span> run</span>
            <span>model: <strong style={{ color: 'var(--text-secondary)' }}>{suite?.model_used || selectedProvider}</strong></span>
          </div>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
        </div>
      </div>

      {/* ---- Credentials configuration modal ---- */}
      {showCredentialsModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCredentialsModal(false);
          }}
        >
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background: 'color-mix(in srgb, #000 45%, transparent)',
              backdropFilter: 'blur(14px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
            }}
          />
          <div
            className="relative w-full max-w-xl rounded-[var(--r-lg)] overflow-hidden flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl), 0 1px 0 rgba(255,255,255,0.04) inset',
              maxHeight: '85vh',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-3 px-4 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-[var(--r-sm)] grid place-items-center shrink-0"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <Key className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[13.5px] font-semibold leading-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    AI provider credentials
                  </div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    Keys are stored locally in your browser. Configure any provider you want to use.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="grid place-items-center w-7 h-7 rounded-[var(--r-sm)] shrink-0 transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — provider list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {AI_PROVIDERS.map((prov) => {
                const hasKey = !!providerKeys[prov.id];
                const isActive = selectedProvider === prov.id;
                return (
                  <div
                    key={prov.id}
                    className="p-2.5 rounded-[var(--r-sm)]"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--accent-500) 5%, var(--bg-canvas))'
                        : 'var(--bg-canvas)',
                      border: `1px solid ${isActive
                          ? 'color-mix(in srgb, var(--accent-500) 25%, transparent)'
                          : 'var(--border-subtle)'
                        }`,
                    }}
                  >
                    {/* Provider header row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        style={{
                          color: hasKey ? 'var(--success-500)' : 'var(--text-tertiary)',
                        }}
                      >
                        {renderProviderIcon(prov.id, 'w-3.5 h-3.5')}
                      </span>
                      <span
                        className="text-[12px] font-medium flex-1 min-w-0 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {prov.name}
                      </span>
                      {hasKey && (
                        <span
                          className="inline-flex items-center gap-0.5 mono text-[9.5px] font-medium px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: 'color-mix(in srgb, var(--success-500) 10%, transparent)',
                            color: 'var(--success-500)',
                          }}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          configured
                        </span>
                      )}
                      {prov.consoleUrl && (
                        <a
                          href={prov.consoleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-0.5 text-[10.5px] font-medium transition-colors"
                          style={{ color: 'var(--accent-500)' }}
                        >
                          Get key
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <input
                        type="password"
                        value={providerKeys[prov.id] || ''}
                        onChange={(e) => handleUpdateKey(prov.id, e.target.value)}
                        placeholder={prov.keyPlaceholder}
                        className="w-full h-7 px-2 rounded mono text-[11px] outline-none transition-all"
                        style={{
                          background: 'var(--bg-surface)',
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
                      <input
                        type="text"
                        value={customBaseUrls[prov.id] || ''}
                        onChange={(e) => handleUpdateBaseUrl(prov.id, e.target.value)}
                        placeholder={`Base URL (default: ${prov.defaultBaseUrl})`}
                        className="w-full h-7 px-2 rounded mono text-[11px] outline-none transition-all"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-focus)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-default)';
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-canvas)',
              }}
            >
              <span className="mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                Stored in browser localStorage · never sent to go-apidocs
              </span>
              <button
                type="button"
                onClick={() => setShowCredentialsModal(false)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-semibold transition-all"
                style={{
                  background: 'var(--accent-500)',
                  color: 'var(--text-inverse)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-400)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-500)';
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* ---- k6/Locust export modal (nested) ---- */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowExportModal(false)}>
          <div
            className="absolute inset-0"
            style={{ background: 'color-mix(in srgb, #000 45%, transparent)', backdropFilter: 'blur(12px)' }}
          />
          <div
            className="relative w-full max-w-2xl rounded-[var(--r-lg)] overflow-hidden flex flex-col"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '80vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  Export load test script
                </span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="grid place-items-center w-7 h-7 rounded-[var(--r-sm)] transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {(['k6', 'locust'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className="h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                  style={
                    exportFormat === f
                      ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-tertiary)' }
                  }
                >
                  {f === 'k6' ? 'Grafana k6' : 'Locust (Python)'}
                </button>
              ))}
            </div>

            <pre
              className="flex-1 p-4 mono text-[11px] leading-relaxed overflow-auto"
              style={{
                background: 'var(--bg-canvas)',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {exportFormat === 'k6' ? generateK6Script() : generateLocustScript()}
            </pre>

            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                {exportFormat === 'k6' ? 'k6 run loadtest.js' : 'locust -f locustfile.py --host=...'}
              </span>
              <PrimaryBtn
                onClick={() => {
                  const s = exportFormat === 'k6' ? generateK6Script() : generateLocustScript();
                  navigator.clipboard.writeText(s);
                  setExportCopied(true);
                  setTimeout(() => setExportCopied(false), 2000);
                }}
                Icon={exportCopied ? Check : Copy}
              >
                {exportCopied ? 'Copied' : 'Copy script'}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ============================================================
   SAVED REPORTS PANEL (preserved, tokenized)
   ============================================================ */

interface SavedReportMeta {
  id: string;
  title: string;
  endpoint_key: string;
  provider?: string;
  model?: string;
  saved_at: string;
  summary?: { total: number; passed: number; failed: number };
  suites?: Record<string, AITestSuite>;
}

export const SavedReportsPanel: React.FC<{ onOpenReport: (rep: SavedReportMeta) => void }> = ({
  onOpenReport,
}) => {
  const [reports, setReports] = useState<SavedReportMeta[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/docs/qa/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) refresh();
  }, [expanded]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/docs/qa/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch { }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
        style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <FolderOpen className="w-3.5 h-3.5" />
        Saved reports
      </button>
    );
  }

  return (
    <div
      className="p-3 rounded-[var(--r-md)] space-y-2"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
            Saved reports
          </span>
          <span
            className="mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--bg-overlay)', color: 'var(--text-tertiary)' }}
          >
            {reports.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={refresh}
            className="grid place-items-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="grid place-items-center w-6 h-6 rounded transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {reports.length === 0 && !loading && (
        <div className="text-[11px] text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
          No saved reports. Run a suite and click SAVE to persist.
        </div>
      )}

      <div className="space-y-1 max-h-52 overflow-y-auto">
        {reports.map((r) => {
          const s = r.summary;
          const allPass = s && s.total > 0 && s.passed === s.total;
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 p-2 rounded group"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-canvas)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: allPass ? 'var(--success-500)' : s && s.failed > 0 ? 'var(--danger-500)' : 'var(--text-tertiary)',
                }}
              />
              <button
                type="button"
                onClick={() => onOpenReport(r)}
                className="min-w-0 flex-1 text-left"
                title="Load report"
              >
                <div className="text-[11.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {r.title}
                </div>
                <div className="mono text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {r.endpoint_key}
                  {s ? ` · ${s.passed}/${s.total} passed` : ''}
                  {r.model ? ` · ${r.model}` : ''}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="grid place-items-center w-6 h-6 rounded transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger-500)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-500) 8%, transparent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};