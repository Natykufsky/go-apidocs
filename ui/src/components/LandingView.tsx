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
  UploadCloud,
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
      <section className="relative border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-slate-900 dark:via-[#0b0f17] dark:to-slate-900/50 pt-10 pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-24 left-1/4 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Top Pill / Status Tag */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-mono font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>go-apidocs v2.0 Enterprise</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-600 dark:text-slate-400">{activeWs?.name || 'Default Workspace'}</span>
            </div>

            {/* Quick Install Command Badge */}
            <div className="flex items-center gap-2 bg-slate-900 dark:bg-black text-white px-3.5 py-1.5 rounded-xl text-xs font-mono shadow-xs border border-slate-800">
              <span className="text-emerald-400 font-bold">$</span>
              <span className="text-slate-200 select-all font-medium">go get github.com/Natykufsky/go-apidocs</span>
              <button
                type="button"
                onClick={() => handleCopy('go get github.com/Natykufsky/go-apidocs', 'goget')}
                className="text-slate-400 hover:text-white transition-colors ml-1.5 cursor-pointer p-1 rounded hover:bg-slate-800"
                title="Copy install command"
                aria-label="Copy install command"
              >
                {copiedKey === 'goget' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Main Hero Section & CTAs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.14]">
                The API Docs Cloud Platform & Automated QA Engine
              </h1>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-2xl">
                A single-binary developer hub combining interactive OpenAPI execution, OWASP vulnerability audits, multi-tenant SaaS quotas, and multi-LLM automated test synthesis.
              </p>

              {/* Strict Visual Hierarchy for CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {/* PRIMARY CTA */}
                <button
                  type="button"
                  onClick={() => onNavigate('/docs')}
                  className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer min-h-[44px]"
                >
                  <Zap className="w-4 h-4 fill-current text-emerald-400 dark:text-emerald-600" />
                  <span>Launch API Sandbox</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>

                {/* SECONDARY OUTLINE CTAs */}
                {securityAuditEnabled && onOpenSecurityAudit && (
                  <button
                    type="button"
                    onClick={onOpenSecurityAudit}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer min-h-[44px]"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Run Security Audit</span>
                  </button>
                )}

                {writesEnabled && onOpenImporter && (
                  <button
                    type="button"
                    onClick={onOpenImporter}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-xs font-semibold transition-all shadow-2xs hover:shadow-xs cursor-pointer min-h-[44px]"
                  >
                    <UploadCloud className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span>Import API Spec</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Telemetry Metrics Cards */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
              <div
                onClick={() => setActiveTab('endpoints')}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 cursor-pointer group"
                title="View active endpoints"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Endpoints
                  </span>
                  <Activity className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono mt-2">
                  {stats.totalEndpoints || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors font-medium">
                  Active operations &rarr;
                </div>
              </div>

              <div
                onClick={() => setActiveTab('services')}
                className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer group"
                title="View microservices"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Microservices
                  </span>
                  <Layers className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono mt-2">
                  {activeWs?.services?.length || 1}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium">
                  Isolated schemas &rarr;
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    External Deps
                  </span>
                  <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-2">
                  0ms
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  embed.FS standalone
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    JSON Schemas
                  </span>
                  <Box className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-2xl font-extrabold text-slate-950 dark:text-white font-mono mt-2">
                  {stats.totalSchemas || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  Type specifications
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
              className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
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
              className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
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
              className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
                activeTab === 'services'
                  ? 'border-slate-950 dark:border-white text-slate-950 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Microservices ({activeWs?.services?.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('endpoints')}
              className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
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
              className={`pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap min-h-[44px] ${
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
              className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[36px]"
            >
              {maskConfidential ? <EyeOff className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5" />}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Cpu className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Zero-Dependency Architecture
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Engineered strictly with Go's standard library and embed FS. No Node.js runtime, no CGO bindings, and zero runtime dependencies for lightning fast boot times.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Standard Library</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">embed.FS</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Self-Contained</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Multi-LLM Test Synthesis & Runner
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Synthesize robust edge-case and injection test suites using DeepSeek v4.1 on NVIDIA NIM, OpenAI GPT-4o, Anthropic Claude 3.5, or 100% offline local Ollama instances.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">NVIDIA DeepSeek</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">GPT-4o</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Ollama Local</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  OWASP API Security Scanner
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Automated static analysis detecting Broken Object Level Auth (BOLA/IDOR), missing authorization controls, CORS misconfigurations, and live multi-vector fuzzing payloads.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">OWASP Top 10</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">SSRF Protection</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Security Headers</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white font-bold">
                  <Cloud className="w-5 h-5 text-sky-500" />
                </div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Multi-Tenant SaaS Isolation
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Built-in organization subdomain resolver, custom tenant branding, rate limit enforcement, API call quotas, and HMAC-verified Stripe webhook billing integration.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-500">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Stripe Webhooks</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Subdomain Routing</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold">Usage Quotas</span>
                </div>
              </div>
            </div>

            {/* Direct 1-Minute Go Integration Snippet */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">
                    Drop-in Go Integration
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mount the portal on any native Go HTTP server with full type safety and zero boilerplate.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                    Go Standard Library
                  </span>
                </div>
              </div>

              {/* Code Snippet Container */}
              <div className="relative rounded-2xl bg-slate-950 text-slate-200 p-4 sm:p-5 font-mono text-xs overflow-x-auto border border-slate-800">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400 text-[11px]">
                  <span>main.go</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(CODE_INTEGRATION_SNIPPET, 'snippet')}
                    className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded bg-slate-900 hover:bg-slate-800"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AUDIENCE_PERSONAS.map((persona) => (
                <div
                  key={persona.id}
                  className="p-6 rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{persona.icon}</span>
                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">{persona.role}</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                        {persona.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {persona.description}
                    </p>

                    <ul className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      {persona.points.map((pt, idx) => (
                        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('/docs')}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200/70 dark:border-slate-700/80 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
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

        {/* TAB 3: WORKSPACE MICROSERVICES & DROP ZONE */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white">
                  {activeWs?.name || 'Workspace'} Microservices
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Switch between registered services to test sandbox routes, run security audits, or export documentation.
                </p>
              </div>

              {writesEnabled && onOpenImporter && (
                <button
                  type="button"
                  onClick={onOpenImporter}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Import Spec</span>
                </button>
              )}
            </div>

            {/* Responsive CSS Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeWs?.services?.map((svc) => {
                const isSelected = svc.id === activeServiceId;
                return (
                  <div
                    key={svc.id}
                    className={`rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between space-y-4 bg-white dark:bg-[#0d121f] ${
                      isSelected
                        ? 'border-slate-900 dark:border-slate-400 shadow-md ring-1 ring-slate-900/10'
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0 font-bold">
                            {svc.icon || '⚡'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-950 dark:text-white leading-tight">{svc.title}</h3>
                            <span className="text-[11px] text-slate-500 font-mono">
                              v{svc.version || '1.0.0'} • {svc.id}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase font-mono">
                            Active
                          </span>
                        )}
                      </div>

                      {svc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{svc.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          onNavigate('/docs');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[40px]"
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
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                          title="Run Security Audit"
                          aria-label="Run Security Audit"
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
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="View Documentation Guide"
                        aria-label="View Documentation Guide"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Elevated Interactive Drop Zone Empty State */}
              {writesEnabled && onOpenImporter && (
                <div
                  onClick={onOpenImporter}
                  className="rounded-2xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-400 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/80 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer group min-h-[220px] space-y-3"
                  role="button"
                  tabIndex={0}
                  aria-label="Register Another API Spec"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-110 group-hover:text-slate-900 dark:group-hover:text-white transition-all shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Register Another API Spec
                    </div>
                    <div className="text-xs text-slate-500 mt-1 max-w-[200px]">
                      Drag & drop JSON/YAML OpenAPI spec file here, or click to browse
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Plus className="w-3 h-3" />
                    <span>Upload Spec</span>
                  </span>
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
