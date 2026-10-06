import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen,
  Terminal,
  Activity,
  FileCode,
  CheckCircle2,
  Layers,
  ArrowRight,
  Hash,
  Box,
  FileText,
  Search,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronRight,
  Cpu,
  Lock,
  Server,
  Cloud,
  Code2,
  Boxes,
  Database,
  Sliders,
  Workflow,
  KeyRound,
  ShieldCheck as ShieldIcon,
  PlayCircle,
  Globe,
  Radio,
  Users,
  Building,
  Target,
} from 'lucide-react';
import { marked } from 'marked';
import { NavConfig } from './Navbar';
import { Workspace, APIService } from './WorkspaceSwitcher';

interface LandingViewProps {
  config: NavConfig;
  workspaces?: Workspace[];
  activeWorkspaceId?: string;
  activeServiceId?: string;
  writesEnabled?: boolean;
  securityAuditEnabled?: boolean;
  onSelectService?: (workspaceId: string, serviceId: string) => void;
  onOpenImporter?: () => void;
  onOpenSecurityAudit?: () => void;
  onNavigate: (path: string) => void;
}

interface TagStat {
  name: string;
  description?: string;
  count: number;
  methods: Record<string, number>;
}

interface SpecStats {
  totalEndpoints: number;
  methods: Record<string, number>;
  totalTags: number;
  totalSchemas: number;
  tagStats: TagStat[];
  infoTitle?: string;
  infoDescription?: string;
  version?: string;
}

const AUDIENCE_PERSONAS = [
  {
    id: 'backend',
    role: 'Backend Engineers & Architects',
    badge: 'Core Engine',
    icon: '⚡',
    description: 'Instant developer documentation and live Swagger sandbox with zero external dependencies.',
    points: [
      'Pure Go standard library & embed.FS — zero npm/node runtimes',
      'One-line initialization for native HTTP servers',
      'Multi-workspace & microservices orchestration out-of-the-box',
    ],
  },
  {
    id: 'security',
    role: 'DevSecOps & Security QA',
    badge: 'OWASP Top 10',
    icon: '🛡️',
    description: 'Proactive API vulnerability scanning and automated compliance verification.',
    points: [
      'Static specification scanner detecting BOLA, IDOR & unauthenticated routes',
      'Multi-vector client-side fuzzing (SQLi, NoSQL, SSRF, Command Injection)',
      'Automated RFC 4180 Excel & Markdown audit reporting',
    ],
  },
  {
    id: 'qa',
    role: 'QA Automation Engineers',
    badge: 'AI Synthesis',
    icon: '🤖',
    description: 'Multi-LLM test generation and live assertion execution runner.',
    points: [
      'Synthesizes edge cases, auth validation & boundary tests in seconds',
      'NVIDIA NIM (DeepSeek v4.1), OpenAI, Anthropic, or 100% offline Local Ollama',
      'Batch test runner with live status and assertion inspectors',
    ],
  },
  {
    id: 'saas',
    role: 'B2B SaaS Platform Teams',
    badge: 'Multi-Tenant',
    icon: '🏢',
    description: 'Enterprise tenant isolation, usage limits, and subscription billing.',
    points: [
      'Subdomain & API-Key organization routing with isolated quotas',
      'Custom white-label branding, custom CSS & dynamic themes',
      'HMAC-verified Stripe webhook billing integration',
    ],
  },
];

const CODE_INTEGRATION_SNIPPET = `package main

import (
    "net/http"
    "github.com/Natykufsky/go-apidocs"
)

func main() {
    mux := http.NewServeMux()

    // ⚡ Mount API documentation, Swagger sandbox & QA portal in 1 line
    apidocs.MountNetHTTP(mux, apidocs.Config{
        Title:               "Acme Cloud Core API",
        Subtitle:            "Developer Reference & Automated QA Hub",
        SpecFilePath:        "./docs/swagger.json",
        EnableWorkspaces:    true,
        EnableSecurityAudit: true,
    })

    http.ListenAndServe(":8080", mux)
}`;

export const LandingView: React.FC<LandingViewProps> = ({
  config,
  workspaces = [],
  activeWorkspaceId = 'default',
  activeServiceId = 'default',
  writesEnabled = false,
  securityAuditEnabled = false,
  onSelectService,
  onOpenImporter,
  onOpenSecurityAudit,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'audience' | 'guide' | 'endpoints'>('overview');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState<boolean>(true);
  const [spec, setSpec] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [maskConfidential, setMaskConfidential] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch README.md from /docs/readme
  useEffect(() => {
    setReadmeLoading(true);
    let url = `/docs/readme?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    fetch(url)
      .then((res) => {
        if (res.ok) return res.text();
        throw new Error('No readme found');
      })
      .then((text) => {
        setReadmeContent(text);
        setReadmeLoading(false);
      })
      .catch(() => {
        setReadmeContent('# ' + config.title + '\n\nWelcome to the developer documentation portal.');
        setReadmeLoading(false);
      });
  }, [config.title, activeWorkspaceId, activeServiceId]);

  // Fetch Swagger Spec for Realtime Statistics
  useEffect(() => {
    let url = `/docs/swagger.json?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch(() => {});
  }, [activeWorkspaceId, activeServiceId]);

  // Compute Real-time Statistics from Swagger Spec
  const stats: SpecStats = useMemo(() => {
    if (!spec || !spec.paths) {
      return {
        totalEndpoints: 0,
        methods: {},
        totalTags: 0,
        totalSchemas: 0,
        tagStats: [],
      };
    }

    const methods: Record<string, number> = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
      PATCH: 0,
    };
    let totalEndpoints = 0;
    const tagMap: Record<string, { description?: string; count: number; methods: Record<string, number> }> = {};

    if (Array.isArray(spec.tags)) {
      spec.tags.forEach((t: any) => {
        if (t && t.name) {
          tagMap[t.name] = {
            description: t.description,
            count: 0,
            methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 },
          };
        }
      });
    }

    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      for (const method in pathItem) {
        const upperM = method.toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(upperM)) {
          totalEndpoints++;
          methods[upperM] = (methods[upperM] || 0) + 1;

          const op = pathItem[method];
          const opTags: string[] = op.tags && op.tags.length > 0 ? op.tags : ['General'];
          opTags.forEach((tagName) => {
            if (!tagMap[tagName]) {
              tagMap[tagName] = {
                count: 0,
                methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 },
              };
            }
            tagMap[tagName].count++;
            tagMap[tagName].methods[upperM] = (tagMap[tagName].methods[upperM] || 0) + 1;
          });
        }
      }
    }

    let schemaCount = 0;
    if (spec.components && spec.components.schemas) {
      schemaCount = Object.keys(spec.components.schemas).length;
    } else if (spec.definitions) {
      schemaCount = Object.keys(spec.definitions).length;
    }

    const tagStats: TagStat[] = Object.keys(tagMap).map((name) => ({
      name,
      description: tagMap[name].description,
      count: tagMap[name].count,
      methods: tagMap[name].methods,
    }));

    return {
      totalEndpoints,
      methods,
      totalTags: tagStats.length,
      totalSchemas: schemaCount,
      tagStats: tagStats.sort((a, b) => b.count - a.count),
      infoTitle: spec.info?.title,
      infoDescription: spec.info?.description,
      version: spec.info?.version,
    };
  }, [spec]);

  // Mask confidential strings in markdown
  const processedReadmeHtml = useMemo(() => {
    if (!readmeContent) return '';
    let processed = readmeContent;
    if (maskConfidential) {
      processed = processed
        .replace(/DOCS_AUTH_USER=[^\s\n]+/g, 'DOCS_AUTH_USER=••••••••')
        .replace(/DOCS_AUTH_PASS=[^\s\n]+/g, 'DOCS_AUTH_PASS=••••••••')
        .replace(/JWT_SECRET=[^\s\n]+/g, 'JWT_SECRET=••••••••')
        .replace(/Bearer\s+ey[A-Za-z0-9-_=]+/g, 'Bearer ey••••••••')
        .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA••••••••••••••••');
    }
    return marked.parse(processed) as string;
  }, [readmeContent, maskConfidential]);

  return (
    <div className="flex-1 bg-[#fafafa] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans selection:bg-slate-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Monolith Header Bar & Hero Section */}
      <section className="relative border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] pt-12 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Top Pill / Status Tag */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>go-apidocs v2.0 Enterprise Engine</span>
              <span className="text-slate-400">/</span>
              <span>{activeWs?.name || 'Default Workspace'}</span>
            </div>

            {/* Quick Install Command Badge */}
            <div className="flex items-center gap-2 bg-slate-900 dark:bg-black text-white px-3.5 py-1.5 rounded-xl text-xs font-mono shadow-xs border border-slate-800">
              <span className="text-emerald-400">$</span>
              <span className="text-slate-200 select-all">go get github.com/Natykufsky/go-apidocs</span>
              <button
                type="button"
                onClick={() => handleCopy('go get github.com/Natykufsky/go-apidocs', 'goget')}
                className="text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer"
                title="Copy install command"
              >
                {copiedKey === 'goget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Main Hero Typography */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.12]">
                The High-Performance API Hub & Automated QA Engine for Go
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed max-w-2xl">
                A single-binary developer portal combining interactive OpenAPI execution, OWASP static & dynamic vulnerability audits, multi-tenant SaaS quotas, and multi-LLM automated test synthesis.
              </p>

              {/* Monolith Action Row */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/docs')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Launch API Sandbox</span>
                </button>

                {securityAuditEnabled && onOpenSecurityAudit && (
                  <button
                    type="button"
                    onClick={onOpenSecurityAudit}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Run OWASP Security Audit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('guide')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Developer Reference</span>
                </button>
              </div>
            </div>

            {/* High-Density Live Telemetry Metrics */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono">
                  {stats.totalEndpoints || 0}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Endpoints
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono">
                  {activeWs?.services?.length || 1}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Microservices
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  0ms
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  External Deps
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono">
                  {stats.totalSchemas || 0}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  JSON Schemas
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Navigation Segmented Control */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Overview & Architecture</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audience')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'audience'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Target Audience & Teams</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'services'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Workspace Microservices ({activeWs?.services?.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('endpoints')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'endpoints'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Endpoint Directory ({stats.totalEndpoints})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Documentation Guide</span>
            </button>
          </div>

          {activeTab === 'guide' && (
            <button
              type="button"
              onClick={() => setMaskConfidential(!maskConfidential)}
              className="mb-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {maskConfidential ? <EyeOff className="w-3 h-3 text-emerald-600" /> : <Eye className="w-3 h-3" />}
              <span className="text-[11px]">{maskConfidential ? 'Secrets Masked' : 'Unmasked'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Content Panes */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: OVERVIEW & ARCHITECTURE */}
        {activeTab === 'overview' && (
          <div className="space-y-12">
            
            {/* 4 Core Pillars Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Cpu className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Zero-Dependency Architecture
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Engineered strictly with Go's standard library and embed FS. No Node.js runtime, no CGO bindings, and zero runtime dependencies for lightning fast boot times.
                </p>
                <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Standard Library</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">embed.FS</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Self-Contained</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Multi-LLM Test Synthesis & Runner
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Synthesize robust edge-case and injection test suites using DeepSeek v4.1 on NVIDIA NIM, OpenAI GPT-4o, Anthropic Claude 3.5, or 100% offline local Ollama instances.
                </p>
                <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">NVIDIA DeepSeek</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">GPT-4o</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Ollama Local</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  OWASP API Security Scanner
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Automated static analysis detecting Broken Object Level Auth (BOLA/IDOR), missing authorization controls, CORS misconfigurations, and live multi-vector fuzzing payloads.
                </p>
                <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">OWASP Top 10</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">SSRF Protection</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Security Headers</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Cloud className="w-5 h-5 text-sky-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Multi-Tenant SaaS Isolation
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Built-in organization subdomain resolver, custom tenant branding, rate limit enforcement, API call quotas, and HMAC-verified Stripe webhook billing integration.
                </p>
                <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Stripe Webhooks</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Subdomain Routing</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Usage Quotas</span>
                </div>
              </div>
            </div>

            {/* Direct 1-Minute Go Integration Snippet */}
            <div className="p-6 rounded-3xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    Drop-in Go Integration
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mount the portal on any HTTP server with full type safety and zero boilerplate.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                    Go Standard Library
                  </span>
                </div>
              </div>

              {/* Code Snippet Container */}
              <div className="relative rounded-2xl bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto border border-slate-800">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                  <span>main.go</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(CODE_INTEGRATION_SNIPPET, 'snippet')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedKey === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'snippet' ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="text-slate-300 leading-relaxed font-mono">
                  <code>{CODE_INTEGRATION_SNIPPET}</code>
                </pre>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: TARGET AUDIENCE & PERSONAS */}
        {activeTab === 'audience' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">
                Engineered for Modern Software Teams
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Whether you are crafting high-throughput microservices, auditing financial APIs, or managing SaaS quotas, go-apidocs scales to your role.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AUDIENCE_PERSONAS.map((persona) => (
                <div
                  key={persona.id}
                  className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{persona.icon}</span>
                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">{persona.role}</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                        {persona.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {persona.description}
                    </p>

                    <ul className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {persona.points.map((pt, idx) => (
                        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('/docs')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore {persona.badge} Features</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: WORKSPACE MICROSERVICES */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  {activeWs?.name || 'Workspace'} Microservices
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switch between registered services to test sandbox routes, run security audits, or export documentation.
                </p>
              </div>

              {writesEnabled && onOpenImporter && (
                <button
                  type="button"
                  onClick={onOpenImporter}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Import Spec</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeWs?.services?.map((svc) => {
                const isSelected = svc.id === activeServiceId;
                return (
                  <div
                    key={svc.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 bg-white dark:bg-[#0d121f] ${
                      isSelected
                        ? 'border-slate-950 dark:border-slate-400 shadow-md ring-1 ring-slate-950/10'
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base">
                            {svc.icon || '⚡'}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-950 dark:text-white leading-tight">{svc.title}</h3>
                            <span className="text-[10px] text-slate-500 font-mono">
                              v{svc.version || '1.0.0'} • {svc.id}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase font-mono">
                            Active
                          </span>
                        )}
                      </div>

                      {svc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{svc.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          onNavigate('/docs');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Sandbox</span>
                      </button>

                      {securityAuditEnabled && onOpenSecurityAudit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectService) onSelectService(activeWs.id, svc.id);
                            onOpenSecurityAudit();
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Run Security Audit"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          setActiveTab('guide');
                        }}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="View Documentation Guide"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {writesEnabled && onOpenImporter && (
                <div
                  onClick={onOpenImporter}
                  className="rounded-2xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-white/50 dark:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-center cursor-pointer group min-h-[160px]"
                >
                  <Plus className="w-7 h-7 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white mb-2 transition-transform group-hover:scale-110" />
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Register Another API Spec</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Upload JSON/YAML or fetch URL</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ENDPOINTS DIRECTORY */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-white dark:bg-[#0d121f] rounded-2xl border border-slate-200/90 dark:border-slate-800 flex items-center gap-3 shadow-xs">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search endpoints by tag or path..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none bg-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.tagStats
                .filter((t) => t.name.toLowerCase().includes(tagFilter.toLowerCase()))
                .map((tag) => (
                  <div key={tag.name} className="bg-white dark:bg-[#0d121f] p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{tag.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        {tag.count} operations
                      </span>
                    </div>
                    {tag.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{tag.description}</p>}
                    <div className="flex gap-1.5 pt-1">
                      {Object.entries(tag.methods).map(([m, count]) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                          {m} <span className="text-slate-400">({count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 5: DEVELOPER GUIDE */}
        {activeTab === 'guide' && (
          <div className="bg-white dark:bg-[#0d121f] rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            {readmeLoading ? (
              <div className="py-20 text-center text-xs font-bold text-slate-500">Loading documentation guide...</div>
            ) : (
              <div
                className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-emerald-600"
                dangerouslySetInnerHTML={{ __html: processedReadmeHtml }}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
};
