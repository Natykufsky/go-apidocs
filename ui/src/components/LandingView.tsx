import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen,
  Terminal,
  Activity,
  FileCode,
  CheckCircle2,
  Layers,
  ArrowRight,
  Box,
  FileText,
  Search,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  Cpu,
  Cloud,
  Building,
  Users,
  Play,
  Download,
  X,
  Minus,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Rocket,
  FileJson,
  Lock,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { NavConfig } from './Navbar';
import { Workspace } from './WorkspaceSwitcher';
import { SkeletonStats } from './Skeletons';
import { MarkdownPreview } from './MarkdownPreview';

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

/* ============================================================
   CONTENT DATA
   ============================================================ */

const STEPS = [
  {
    n: '01',
    title: 'Import your spec',
    body: 'Drop in an OpenAPI 3.0, 3.1, or Swagger 2.0 file — or fetch it from a URL. Syntax is validated client-side before mounting.',
    Icon: FileJson,
  },
  {
    n: '02',
    title: 'Mount on your server',
    body: 'One line of Go. The portal appears at /docs next to your existing routes. No Node.js, no build step, no separate deploy.',
    Icon: GitBranch,
  },
  {
    n: '03',
    title: 'Ship with confidence',
    body: 'Run QA suites, OWASP audits, and multi-tenant quotas — all from the binary you were already going to deploy.',
    Icon: Rocket,
  },
];

const FEATURES = [
  {
    Icon: Cpu,
    title: 'Zero runtime, zero risk',
    body: 'No Node.js, no Docker, no external services. The entire portal ships inside your Go binary via embed.FS — deploy to Docker, Kubernetes, cPanel, or air-gapped networks.',
    tags: ['Go stdlib', 'embed.FS', 'Self-contained'],
  },
  {
    Icon: Terminal,
    title: 'A sandbox developers actually use',
    body: 'Try-it-out with auto-captured auth tokens, saved examples, and language-switchable snippets. Extended with QA state, PII masking, and mock scenarios.',
    tags: ['Try it out', 'Token capture', 'cURL · Go · Node · Python'],
  },
  {
    Icon: ShieldCheck,
    title: 'Automated security posture',
    body: 'Static scans catch missing auth, unbounded schemas, and leaked credentials. Live probes verify CSP, HSTS, and CORS. Assign a 0–100 grade per service.',
    tags: ['OWASP Top 10', 'SSRF hardened', 'Live headers'],
  },
  {
    Icon: Sparkles,
    title: 'AI tests in your language',
    body: 'Synthesize happy paths, edge cases, and injection probes with DeepSeek, GPT-4o, Claude, or 100% offline Ollama. Execute directly from the portal — no CI setup required.',
    tags: ['NVIDIA NIM', 'GPT-4o', 'Offline Ollama'],
  },
  {
    Icon: Cloud,
    title: 'Multi-tenant, out of the box',
    body: 'Subdomain resolution, per-tenant token metering, custom storage limits, and Stripe webhook lifecycle — all in the same binary you deploy.',
    tags: ['Subdomain routing', 'Quotas', 'Stripe'],
  },
  {
    Icon: Layers,
    title: 'Your brand, not ours',
    body: 'Per-tenant logos, primary/accent palettes, custom CSS, and light/dark modes. Ship a portal that feels like you built it — because you did.',
    tags: ['White-label', 'Custom CSS', 'Light/dark'],
  },
];

const PERSONAS = [
  {
    Icon: GitBranch,
    role: 'Platform teams shipping Go microservices',
    body: 'Give every new service a developer portal on day one — no infrastructure to stand up, no separate deploy pipeline, no third-party vendor review.',
  },
  {
    Icon: ShieldCheck,
    role: 'Security engineers defending public APIs',
    body: 'Prove OWASP compliance to auditors. Catch missing auth on mutating routes before attackers do. Export findings to Jira or GitHub Issues.',
  },
  {
    Icon: Sparkles,
    role: 'QA teams automating test coverage',
    body: 'Synthesize thousands of edge-case tests per service in minutes. No test framework to learn, no CI integration required, no manual scripting.',
  },
  {
    Icon: Building,
    role: 'B2B SaaS teams serving enterprise customers',
    body: 'White-label a developer portal for every tenant. Meter usage, enforce quotas, integrate Stripe — without building a second product.',
  },
];

const COMPARISON = {
  columns: ['go-apidocs', 'Swagger UI', 'Redoc', 'Mintlify'],
  rows: [
    { label: 'Runs in your Go binary', values: [true, false, false, false] },
    { label: 'Zero runtime dependencies', values: [true, false, false, false] },
    { label: 'Self-hosted (no vendor)', values: [true, true, true, 'Paid'] },
    { label: 'Interactive sandbox', values: [true, true, false, true] },
    { label: 'OWASP security audit', values: [true, false, false, false] },
    { label: 'AI test synthesis', values: [true, false, false, false] },
    { label: 'Multi-tenant SaaS', values: [true, false, false, 'Paid'] },
    { label: 'MIT licensed', values: [true, true, true, false] },
    { label: 'Price', values: ['Free', 'Free', 'Free', '$$$'] },
  ],
};

const FAQS = [
  {
    q: 'Which OpenAPI versions are supported?',
    a: 'OpenAPI 3.0, 3.1, and Swagger 2.0. Imports validate against the official schema before mounting — invalid specs are rejected with a line/column error and a link to the offending node.',
  },
  {
    q: 'Does it require Node.js or a build step?',
    a: 'No. Everything is compiled into your Go binary via embed.FS. There is no npm install, no webpack, no vite, and no separate deployment pipeline for the portal.',
  },
  {
    q: 'Can the portal run fully air-gapped?',
    a: 'Yes. AI test synthesis supports local Ollama, and the portal makes zero external CDN calls. Fonts, icons, styles, and JavaScript are all embedded.',
  },
  {
    q: 'How is multi-tenancy enforced?',
    a: 'Subdomain resolution (acme.your-platform.com), per-tenant token metering, isolated storage quotas, and HMAC-verified Stripe webhook lifecycle. Each tenant gets their own theme, quotas, and audit trail.',
  },
  {
    q: 'What happens to my API data?',
    a: 'Nothing leaves your binary. Spec data, QA records, and captured credentials stay local unless you explicitly configure an external AI provider. Local Ollama mode is fully offline.',
  },
  {
    q: 'Can I customize the branding per tenant?',
    a: 'Yes — logos, primary/accent palettes, custom CSS, and light/dark mode defaults. Branding is applied via CSS variables, so themes update live without a rebuild.',
  },
];

const CODE_SNIPPET = `package main

import (
    "net/http"
    "github.com/Natykufsky/go-apidocs/v2"
)

func main() {
    mux := http.NewServeMux()

    apidocs.MountNetHTTP(mux, apidocs.Config{
        Title:               "Acme Cloud Core API",
        SpecFilePath:        "./docs/swagger.json",
        EnableWorkspaces:    true,
        EnableSecurityAudit: true,
        EnableAITestStudio:  true,
    })

    http.ListenAndServe(":8080", mux)
}`;

/* ============================================================
   PRIMITIVES
   ============================================================ */

const Btn: React.FC<{
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ variant = 'secondary', size = 'md', onClick, children, className = '', title }) => {
  const cls =
    variant === 'primary' ? 'btn btn--primary' : variant === 'ghost' ? 'btn btn--ghost' : 'btn';
  const sizeCls = size === 'sm' ? 'btn--sm' : size === 'lg' ? 'btn--lg' : '';
  return (
    <button type="button" onClick={onClick} title={title} className={`${cls} ${sizeCls} ${className}`}>
      {children}
    </button>
  );
};

const Section: React.FC<{
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
}> = ({ eyebrow, title, subtitle, children, id }) => (
  <section id={id} className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
    <div className="max-w-6xl mx-auto">
      {(eyebrow || title || subtitle) && (
        <div className="mb-10 max-w-2xl">
          {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
          {title && (
            <h2
              className="text-[26px] sm:text-[32px] font-semibold leading-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.022em' }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              className="mt-3 text-[14.5px] leading-relaxed max-w-xl"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  </section>
);

const CheckMark = () => (
  <div className="grid place-items-center w-5 h-5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success-500) 14%, transparent)' }}>
    <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success-500)' }} />
  </div>
);

const DashMark = () => (
  <div className="grid place-items-center w-5 h-5">
    <Minus className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
  </div>
);

/* ============================================================
   MAIN
   ============================================================ */

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
  const [activeTab, setActiveTab] = useState<'services' | 'endpoints' | 'docs'>('services');
  const [markdownDocs, setMarkdownDocs] = useState<Array<{ name: string; title: string; path?: string }>>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>('README.md');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState<boolean>(true);
  const [spec, setSpec] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [maskConfidential, setMaskConfidential] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    const url = `/docs/markdown-docs?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((docs: Array<{ name: string; title: string; path?: string }>) => {
        if (Array.isArray(docs) && docs.length > 0) {
          setMarkdownDocs(docs);
          setSelectedDoc(docs[0].name);
        } else {
          setMarkdownDocs([{ name: 'README.md', title: 'README' }]);
          setSelectedDoc('README.md');
        }
      })
      .catch(() => {
        setMarkdownDocs([{ name: 'README.md', title: 'README' }]);
        setSelectedDoc('README.md');
      });
  }, [activeWorkspaceId, activeServiceId]);

  useEffect(() => {
    setReadmeLoading(true);
    const url = `/docs/readme?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}&file=${encodeURIComponent(selectedDoc)}`;
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
  }, [config.title, activeWorkspaceId, activeServiceId, selectedDoc]);

  useEffect(() => {
    const url = `/docs/swagger.json?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch(() => {});
  }, [activeWorkspaceId, activeServiceId]);

  const stats: SpecStats = useMemo(() => {
    if (!spec || !spec.paths) {
      return { totalEndpoints: 0, methods: {}, totalTags: 0, totalSchemas: 0, tagStats: [] };
    }

    const methods: Record<string, number> = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 };
    let totalEndpoints = 0;
    const tagMap: Record<string, { description?: string; count: number; methods: Record<string, number> }> = {};

    if (Array.isArray(spec.tags)) {
      spec.tags.forEach((t: any) => {
        if (t && t.name) {
          tagMap[t.name] = { description: t.description, count: 0, methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 } };
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
              tagMap[tagName] = { count: 0, methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 } };
            }
            tagMap[tagName].count++;
            tagMap[tagName].methods[upperM] = (tagMap[tagName].methods[upperM] || 0) + 1;
          });
        }
      }
    }

    let schemaCount = 0;
    if (spec.components && spec.components.schemas) schemaCount = Object.keys(spec.components.schemas).length;
    else if (spec.definitions) schemaCount = Object.keys(spec.definitions).length;

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
    return DOMPurify.sanitize(marked.parse(processed) as string, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'em', 'strong', 'del', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
    });
  }, [readmeContent, maskConfidential]);

  const tabButton = (id: typeof activeTab, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setActiveTab(id)}
        className="pb-3 px-3 text-[12.5px] font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        style={{
          color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
          borderBottom: active ? '2px solid var(--accent-500)' : '2px solid transparent',
          marginBottom: -1,
        }}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  };

  return (
    <div style={{ background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      {/* ======================================================
          HERO
          ====================================================== */}
      <section
        className="relative px-4 sm:px-6 lg:px-8 pt-12 pb-16 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% 0%, color-mix(in srgb, var(--accent-500) 8%, transparent), transparent 65%), var(--bg-canvas)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--text-primary) 4%, transparent) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, black 15%, transparent 75%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 15%, transparent 75%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto space-y-8">
          {/* Top status bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex items-center gap-2 h-7 px-2.5 rounded-[var(--r-pill)] text-[11.5px]"
              style={{
                background: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'var(--success-500)',
                  boxShadow: '0 0 0 3px color-mix(in srgb, var(--success-500) 15%, transparent), 0 0 8px color-mix(in srgb, var(--success-500) 60%, transparent)',
                }}
              />
              <span className="mono font-medium">v2.0</span>
              <span style={{ color: 'var(--border-strong)' }}>·</span>
              <span className="truncate max-w-[200px]">{activeWs?.name || 'Default Workspace'}</span>
            </div>

            <div className="flex items-center gap-1">
              <Btn variant="ghost" size="sm" onClick={() => onNavigate('/login')}>
                Sign in
              </Btn>
              <Btn variant="secondary" size="sm" onClick={() => onNavigate('/register')}>
                Create workspace
              </Btn>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="eyebrow">Open-source · MIT · Zero dependencies</div>

              <h1
                className="text-[34px] sm:text-[42px] lg:text-[48px] leading-[1.06] font-semibold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.032em' }}
              >
                Your entire API
                <br />
                developer platform
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}> in one binary.</span>
              </h1>

              <p
                className="text-[15.5px] leading-[1.68] max-w-[540px]"
                style={{ color: 'var(--text-secondary)', letterSpacing: '-0.005em' }}
              >
                Ship interactive OpenAPI docs, a live sandbox, OWASP security audits,
                AI-powered QA test synthesis, and multi-tenant SaaS billing — all mounted
                alongside your existing HTTP server. No Node.js. No build step. No vendor lock-in.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Btn variant="primary" size="lg" onClick={() => onNavigate('/docs')}>
                  <Play className="w-3.5 h-3.5" />
                  Open sandbox
                </Btn>
                <Btn variant="secondary" size="lg" onClick={() => onNavigate('/register')}>
                  <Building className="w-3.5 h-3.5" />
                  Register organization
                </Btn>
              </div>

              {/* Install chip */}
              <div
                className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-sm)] mono text-[12px]"
                style={{
                  background: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ color: 'var(--accent-500)', fontWeight: 500 }}>$</span>
                <span style={{ color: 'var(--text-primary)' }}>go get github.com/Natykufsky/go-apidocs/v2</span>
                <button
                  type="button"
                  onClick={() => handleCopy('go get github.com/Natykufsky/go-apidocs/v2', 'goget')}
                  className="ml-1 p-1 rounded transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label="Copy"
                >
                  {copiedKey === 'goget' ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success-500)' }} /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Product preview */}
            <div className="lg:col-span-5">
              <div
                className="rounded-[var(--r-lg)] overflow-hidden transition-transform duration-300"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                {/* chrome */}
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex gap-1.5">
                    {['#F87171', '#FACC15', '#4ADE80'].map((c) => (
                      <span key={c} className="w-2 h-2 rounded-full" style={{ background: c, opacity: 0.55 }} />
                    ))}
                  </div>
                  <div
                    className="flex-1 mono text-[10.5px] py-0.5 px-2.5 rounded text-center truncate"
                    style={{ background: 'color-mix(in srgb, var(--bg-canvas) 60%, transparent)', color: 'var(--text-tertiary)' }}
                  >
                    acme.go-apidocs.io/docs
                  </div>
                </div>

                {/* endpoints */}
                <div className="p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Endpoints
                    </span>
                    <span className="inline-flex items-center gap-1 mono text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
                      12 / 14
                    </span>
                  </div>

                  <ul className="flex flex-col gap-[1px] mb-3">
                    {[
                      { m: 'GET', p: '/v1/customers/{id}', qa: '14/14', active: false },
                      { m: 'POST', p: '/v1/transfers', qa: '12/14', active: true, warn: true },
                      { m: 'POST', p: '/v1/bills/pay', qa: '5/5', active: false },
                      { m: 'DELETE', p: '/v1/cards/issue', qa: '4/9', active: false, err: true },
                    ].map((row, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-[4px] mono text-[10.5px]"
                        style={{
                          background: row.active ? 'var(--accent-muted)' : 'transparent',
                          color: row.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        <span
                          className="text-[9.5px] font-semibold py-0.5 px-1.5 rounded shrink-0 text-center"
                          style={{
                            minWidth: 44,
                            background: row.m === 'GET' ? 'color-mix(in srgb, var(--info-500) 16%, transparent)' :
                                       row.m === 'POST' ? 'color-mix(in srgb, var(--success-500) 16%, transparent)' :
                                       'color-mix(in srgb, var(--danger-500) 16%, transparent)',
                            color: row.m === 'GET' ? 'var(--info-500)' :
                                   row.m === 'POST' ? 'var(--success-500)' : 'var(--danger-500)',
                          }}
                        >
                          {row.m}
                        </span>
                        <span className="flex-1 truncate">{row.p}</span>
                        <span
                          className="text-[10px] shrink-0"
                          style={{ color: row.err ? 'var(--danger-500)' : row.warn ? 'var(--warning-500)' : 'var(--text-tertiary)' }}
                        >
                          {row.qa}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className="rounded-[6px] overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--bg-canvas) 60%, transparent)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="flex items-center gap-2 px-2.5 py-1.5 mono text-[10px]"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--success-500) 14%, transparent)', color: 'var(--success-500)' }}
                      >
                        201 Created
                      </span>
                      <span style={{ color: 'var(--text-tertiary)' }}>142ms</span>
                    </div>
                    <pre className="p-2.5 mono text-[10px] leading-[1.6] overflow-x-auto" style={{ color: 'var(--text-secondary)', margin: 0 }}>
{`{
  "id": "trf_8f2a91c4",
  "status": "pending",
  "amount": 250000
}`}
                    </pre>
                  </div>
                </div>

                <div
                  className="flex items-center gap-3.5 px-3.5 py-2.5 mono text-[10.5px]"
                  style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
                    12 passed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger-500)' }} />
                    2 failed
                  </span>
                  <span
                    className="ml-auto px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: 'color-mix(in srgb, #A3E635 18%, transparent)', color: '#A3E635' }}
                  >
                    B+
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div
            className="flex flex-wrap items-center gap-3 pt-6 mono text-[12px]"
            style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success-500)' }} />
              <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.totalEndpoints || 128}</b> endpoints
            </span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeWs?.services?.length || 4}</b> services
            </span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>0</b> runtime deps
            </span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              MIT licensed
            </span>
          </div>
        </div>
      </section>

      {/* ======================================================
          HOW IT WORKS
          ====================================================== */}
      <Section
        eyebrow="How it works"
        title="Live in your binary in 3 steps."
        subtitle="No new infrastructure. No new vendor. No new deploy pipeline. Just your existing Go server, one line richer."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="relative p-6 rounded-[var(--r-lg)]"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="mono text-[11px] font-semibold tracking-[0.04em]"
                  style={{ color: 'var(--accent-500)' }}
                >
                  STEP {step.n}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                <step.Icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <h3 className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.012em' }}>
                {step.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ======================================================
          FEATURES
          ====================================================== */}
      <Section
        eyebrow="Capabilities"
        title="Everything a developer portal needs."
        subtitle="Documentation, sandbox, QA, security, and multi-tenancy — one binary, one deploy."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ Icon, title, body, tags }) => (
            <div
              key={title}
              className="p-5 rounded-[var(--r-lg)] transition-all duration-200"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div
                className="w-9 h-9 rounded-[var(--r-md)] grid place-items-center mb-4"
                style={{
                  background: 'var(--accent-muted)',
                  border: '1px solid color-mix(in srgb, var(--accent-500) 18%, transparent)',
                  color: 'var(--accent-500)',
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.012em' }}>
                {title}
              </h3>
              <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                {body}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="h-5 px-1.5 inline-flex items-center rounded-[4px] mono text-[10.5px]"
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ======================================================
          CODE INTEGRATION
          ====================================================== */}
      <Section
        eyebrow="Integration"
        title="One line of Go. The whole platform."
        subtitle="Mount the portal next to your existing routes — no new middleware, no dependency graph to untangle."
      >
        <div
          className="rounded-[var(--r-lg)] overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 mono text-[11.5px]"
            style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
          >
            <span className="inline-flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5" />
              main.go
            </span>
            <button
              type="button"
              onClick={() => handleCopy(CODE_SNIPPET, 'snippet')}
              className="inline-flex items-center gap-1.5 h-6 px-2 rounded transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              {copiedKey === 'snippet' ? <Check className="w-3 h-3" style={{ color: 'var(--success-500)' }} /> : <Copy className="w-3 h-3" />}
              {copiedKey === 'snippet' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            className="p-5 mono text-[12px] leading-relaxed overflow-x-auto"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', margin: 0 }}
          >
            <code>{CODE_SNIPPET}</code>
          </pre>
        </div>
      </Section>

      {/* ======================================================
          WHO IS THIS FOR
          ====================================================== */}
      <Section
        eyebrow="Built for"
        title="For teams shipping to production."
        subtitle="Whether you're a solo Go developer or a platform team serving thousands of tenants, the portal grows with you."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAS.map(({ Icon, role, body }) => (
            <div
              key={role}
              className="p-5 rounded-[var(--r-lg)] flex items-start gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                className="w-9 h-9 rounded-[var(--r-md)] grid place-items-center shrink-0"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-500)',
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13.5px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {role}
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ======================================================
          COMPARISON
          ====================================================== */}
      <Section
        eyebrow="Comparison"
        title="How it compares."
        subtitle="An honest look at what each option gives you — and what it costs you in operational overhead."
      >
        <div
          className="rounded-[var(--r-lg)] overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: 'var(--bg-raised)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Capability
                  </th>
                  {COMPARISON.columns.map((col, i) => (
                    <th
                      key={col}
                      className="text-center px-4 py-3 font-semibold mono text-[11.5px]"
                      style={{
                        color: i === 0 ? 'var(--accent-500)' : 'var(--text-secondary)',
                        background: i === 0 ? 'var(--accent-muted)' : undefined,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.rows.map((row, ri) => (
                  <tr
                    key={row.label}
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                      {row.label}
                    </td>
                    {row.values.map((v, vi) => (
                      <td
                        key={vi}
                        className="text-center px-4 py-2.5"
                        style={{ background: vi === 0 ? 'var(--accent-muted)' : undefined }}
                      >
                        <div className="flex items-center justify-center">
                          {v === true ? (
                            <CheckMark />
                          ) : v === false ? (
                            <DashMark />
                          ) : (
                            <span className="mono text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                              {v}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ======================================================
          QUOTE
          ====================================================== */}
      <Section>
        <div
          className="relative p-8 sm:p-12 rounded-[var(--r-xl)] overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 0%, color-mix(in srgb, var(--accent-500) 6%, transparent), transparent 70%), var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="max-w-3xl mx-auto">
            <div
              className="text-[20px] sm:text-[22px] leading-[1.5] font-medium mb-6"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.012em' }}
            >
              "Every Go service deserves a real developer portal, but nobody wants to run three Node.js
              servers and a Postgres instance just to ship one. So we compiled the whole thing into the binary."
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full grid place-items-center mono text-[12px] font-semibold"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent-500)' }}
              >
                KM
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Kufre N. Moses
                </div>
                <div className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  Creator of go-apidocs
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ======================================================
          LIVE EXPLORER
          ====================================================== */}
      <Section
        eyebrow="Explore live"
        title="Real data from your workspace."
        subtitle="Browse services, endpoints, and documentation directly from the currently active spec."
      >
        <div
          className="flex items-center gap-1 border-b overflow-x-auto mb-6"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {tabButton('services', `Services (${activeWs?.services?.length || 1})`, Layers)}
          {tabButton('endpoints', `Endpoints (${stats.totalEndpoints})`, Terminal)}
          {tabButton('docs', 'Docs', BookOpen)}

          {activeTab === 'docs' && (
            <button
              type="button"
              onClick={() => setMaskConfidential(!maskConfidential)}
              className="ml-auto mb-2 flex items-center gap-1.5 h-7 px-2 rounded-[var(--r-sm)] text-[11px] font-medium"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {maskConfidential ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {maskConfidential ? 'Masked' : 'Unmasked'}
            </button>
          )}
        </div>

        {activeTab === 'services' && (
          <div className="space-y-4">
            {writesEnabled && onOpenImporter && (
              <div className="flex justify-end">
                <Btn variant="primary" onClick={onOpenImporter}>
                  <Plus className="w-3.5 h-3.5" />
                  Import spec
                </Btn>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeWs?.services?.map((svc) => {
                const isSelected = svc.id === activeServiceId;
                return (
                  <div
                    key={svc.id}
                    className="rounded-[var(--r-md)] p-4 flex flex-col gap-3 transition-all"
                    style={{
                      background: 'var(--bg-surface)',
                      border: isSelected ? '1px solid var(--accent-500)' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 0 0 3px var(--accent-muted)' : 'var(--shadow-sm)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-[var(--r-sm)] grid place-items-center shrink-0"
                          style={{
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {svc.title}
                          </h3>
                          <span className="mono text-[10.5px] truncate block" style={{ color: 'var(--text-tertiary)' }}>
                            v{svc.version || '1.0.0'} · {svc.id}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="pill pill--accent shrink-0" style={{ height: 18, fontSize: 10 }}>
                          Active
                        </span>
                      )}
                    </div>
                    {svc.description && (
                      <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {svc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 pt-2 mt-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <Btn
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          onNavigate('/docs');
                        }}
                      >
                        <Zap className="w-3 h-3" />
                        Sandbox
                      </Btn>
                      {securityAuditEnabled && onOpenSecurityAudit && (
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (onSelectService) onSelectService(activeWs.id, svc.id);
                            onOpenSecurityAudit();
                          }}
                          title="Run security audit"
                        >
                          <ShieldCheck className="w-3 h-3" />
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}

              {writesEnabled && onOpenImporter && (
                <button
                  type="button"
                  onClick={onOpenImporter}
                  className="rounded-[var(--r-md)] p-4 flex flex-col items-center justify-center text-center min-h-[180px] gap-2.5 transition-all"
                  style={{
                    background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--text-tertiary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-500)';
                    e.currentTarget.style.color = 'var(--accent-500)';
                    e.currentTarget.style.background = 'var(--accent-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <UploadCloud className="w-5 h-5" />
                  <div>
                    <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Import another spec
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      JSON, YAML, or URL
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 h-9 px-3 rounded-[var(--r-sm)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Filter endpoints by tag…"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[12.5px]"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stats.tagStats
                .filter((t) => t.name.toLowerCase().includes(tagFilter.toLowerCase()))
                .map((tag) => (
                  <div
                    key={tag.name}
                    className="p-4 rounded-[var(--r-md)] space-y-2"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {tag.name}
                      </span>
                      <span
                        className="h-5 px-1.5 inline-flex items-center rounded mono text-[10.5px] shrink-0"
                        style={{
                          background: 'var(--bg-canvas)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {tag.count} ops
                      </span>
                    </div>
                    {tag.description && (
                      <p className="text-[11.5px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                        {tag.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(tag.methods)
                        .filter(([, n]) => n > 0)
                        .map(([m, n]) => (
                          <span
                            key={m}
                            className="h-5 px-1.5 inline-flex items-center rounded mono text-[10.5px]"
                            style={{
                              background: 'var(--bg-canvas)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {m} <span style={{ color: 'var(--text-tertiary)' }}>({n})</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-3">
            {markdownDocs.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 text-[11px] font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  <FileText className="w-3 h-3" />
                  Document:
                </span>
                {markdownDocs.map((doc) => {
                  const active = selectedDoc === doc.name;
                  return (
                    <button
                      key={doc.name}
                      type="button"
                      onClick={() => setSelectedDoc(doc.name)}
                      className="h-7 px-2 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? 'var(--bg-surface)' : 'transparent',
                        border: `1px solid ${active ? 'var(--border-default)' : 'transparent'}`,
                        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      }}
                    >
                      {doc.title || doc.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div
              className="p-6 sm:p-10 rounded-[var(--r-md)]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              {readmeLoading ? (
                <div className="py-20 flex flex-col items-center gap-3 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  <Download className="w-4 h-4 animate-pulse" />
                  Loading documentation…
                </div>
              ) : (
                <MarkdownPreview content={readmeContent} maskConfidential={maskConfidential} />
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ======================================================
          FAQ
          ====================================================== */}
      <Section
        eyebrow="Questions"
        title="Frequently asked."
        subtitle="The most common things teams want to know before mounting go-apidocs."
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <div
                key={i}
                className="rounded-[var(--r-md)] overflow-hidden"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="text-[13.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                    {faq.q}
                  </span>
                  <ChevronDown
                    className="w-4 h-4 shrink-0 transition-transform"
                    style={{
                      color: 'var(--text-tertiary)',
                      transform: open ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </button>
                {open && (
                  <div
                    className="px-4 pb-4 text-[13px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ======================================================
          CTA BANNER
          ====================================================== */}
      <Section>
        <div
          className="relative p-8 sm:p-12 rounded-[var(--r-xl)] text-center overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, color-mix(in srgb, var(--accent-500) 10%, transparent), transparent 70%), var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <h2
            className="text-[24px] sm:text-[30px] font-semibold mb-3"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.022em' }}
          >
            Ship a portal today.
          </h2>
          <p className="text-[14px] max-w-lg mx-auto mb-6" style={{ color: 'var(--text-secondary)' }}>
            Mount go-apidocs on your existing Go service. One line. Zero new infrastructure.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Btn variant="primary" size="lg" onClick={() => onNavigate('/docs')}>
              <Play className="w-3.5 h-3.5" />
              Open sandbox
            </Btn>
            <Btn variant="secondary" size="lg" onClick={() => onNavigate('/register')}>
              <ArrowRight className="w-3.5 h-3.5" />
              Get started
            </Btn>
          </div>
        </div>
      </Section>

      {/* ======================================================
          FOOTER
          ====================================================== */}
      <footer
        className="px-4 sm:px-6 lg:px-8 py-10 border-t"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-[6px] grid place-items-center mono text-[11px] font-bold"
                  style={{
                    background: 'linear-gradient(145deg, var(--accent-400), var(--accent-500))',
                    color: '#04161C',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(34,211,238,0.25)',
                  }}
                >
                  {(config.title || 'go').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toLowerCase() || 'go'}
                </div>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {config.title || 'go-apidocs'}
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                The developer portal that ships inside your Go binary.
              </p>
            </div>

            {[
              {
                heading: 'Product',
                links: [
                  { label: 'Sandbox', url: '/docs' },
                  { label: 'Guide', url: '/guide' },
                  { label: 'Health', url: '/dashboard' },
                  { label: 'Changelog', url: '#' },
                ],
              },
              {
                heading: 'Resources',
                links: [
                  { label: 'API Reference', url: '/docs' },
                  { label: 'Security', url: '#' },
                  { label: 'GitHub', url: 'https://github.com/Natykufsky/go-apidocs' },
                  { label: 'Examples', url: '#' },
                ],
              },
              {
                heading: 'Company',
                links: [
                  { label: 'About', url: '#' },
                  { label: 'Blog', url: '#' },
                  { label: 'Contact', url: '#' },
                  { label: 'Careers', url: '#' },
                ],
              },
              {
                heading: 'Legal',
                links: [
                  { label: 'MIT License', url: 'https://github.com/Natykufsky/go-apidocs/blob/main/LICENSE' },
                  { label: 'Privacy', url: '#' },
                  { label: 'Terms', url: '#' },
                ],
              },
            ].map((col) => (
              <div key={col.heading}>
                <h4
                  className="text-[10.5px] font-semibold uppercase mb-3"
                  style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                >
                  {col.heading}
                </h4>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.url}
                        target={l.url.startsWith('http') ? '_blank' : undefined}
                        rel={l.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-[12px] transition-colors inline-flex items-center gap-1"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        {l.label}
                        {l.url.startsWith('http') && <ExternalLink className="w-2.5 h-2.5" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-3 pt-6 text-[11.5px]"
            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
          >
            <span>© {new Date().getFullYear()} go-apidocs · MIT licensed</span>
            <span className="mono inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
              All systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};