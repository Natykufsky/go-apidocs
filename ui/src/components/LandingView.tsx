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
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { marked } from 'marked';
import { NavConfig } from './Navbar';

interface LandingViewProps {
  config: NavConfig;
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

export const LandingView: React.FC<LandingViewProps> = ({ config, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'readme' | 'endpoints'>('readme');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState<boolean>(true);
  const [spec, setSpec] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [maskConfidential, setMaskConfidential] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Fetch README.md from /docs/readme
  useEffect(() => {
    setReadmeLoading(true);
    fetch('/docs/readme')
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
  }, [config.title]);

  // Fetch Swagger Spec for Realtime Statistics
  useEffect(() => {
    fetch('/docs/swagger.json')
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch(() => {});
  }, []);

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

    // Populate explicit tags from spec
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

    // Traverse all OpenAPI paths and operations
    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      for (const method in pathItem) {
        const upperMethod = method.toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(upperMethod)) {
          totalEndpoints++;
          methods[upperMethod] = (methods[upperMethod] || 0) + 1;

          const op = pathItem[method];
          const tags: string[] = op.tags && op.tags.length > 0 ? op.tags : ['General'];

          tags.forEach((tag) => {
            if (!tagMap[tag]) {
              tagMap[tag] = {
                count: 0,
                methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 },
              };
            }
            tagMap[tag].count++;
            tagMap[tag].methods[upperMethod] = (tagMap[tag].methods[upperMethod] || 0) + 1;
          });
        }
      }
    }

    const tagStats: TagStat[] = Object.keys(tagMap).map((name) => ({
      name,
      description: tagMap[name].description,
      count: tagMap[name].count,
      methods: tagMap[name].methods,
    }));

    tagStats.sort((a, b) => b.count - a.count);

    const schemasCount =
      Object.keys(spec.components?.schemas || spec.definitions || {}).length;

    return {
      totalEndpoints,
      methods,
      totalTags: tagStats.length,
      totalSchemas: schemasCount,
      tagStats,
      infoTitle: spec.info?.title,
      infoDescription: spec.info?.description,
      version: spec.info?.version || '3.0.3',
    };
  }, [spec]);

  // Sanitize & redact confidential details from README text
  const sanitizedReadmeText = useMemo(() => {
    if (!readmeContent) return '';
    if (!maskConfidential) return readmeContent;

    let text = readmeContent;

    // Redact JWT secret keys, passwords, bearer tokens, AWS keys, database connection strings
    text = text.replace(/JWT_SECRET\s*=\s*["']?[^\s"'\n]+["']?/gi, 'JWT_SECRET="********************************"');
    text = text.replace(/DOCS_AUTH_PASS\s*=\s*["']?[^\s"'\n]+["']?/gi, 'DOCS_AUTH_PASS="****************"');
    text = text.replace(/(password|passwd|secret|token|api_key|apikey|client_secret)\s*[:=]\s*["']?[^\s"',\n]+["']?/gi, '$1: "********"');
    text = text.replace(/Bearer\s+ey[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, 'Bearer eyJhbGciOi...[REDACTED_JWT]');
    text = text.replace(/(postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s/]+/gi, '$1://user:********@host:port');

    return text;
  }, [readmeContent, maskConfidential]);

  // Convert README Markdown to GitHub-style HTML
  const parsedReadmeHtml = useMemo(() => {
    if (!sanitizedReadmeText) return '';
    try {
      return marked.parse(sanitizedReadmeText) as string;
    } catch (e) {
      return `<pre class="p-4 bg-slate-900 text-white rounded-xl overflow-x-auto">${sanitizedReadmeText}</pre>`;
    }
  }, [sanitizedReadmeText]);

  // Filtered tags for exploration
  const filteredTags = stats.tagStats.filter((t) =>
    t.name.toLowerCase().includes(tagFilter.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(tagFilter.toLowerCase()))
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Hero Header & Quick Actions */}
      <section className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50/80 border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Live Developer Portal & Documentation
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight">
            {stats.infoTitle || config.title}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
            {stats.infoDescription || config.subtitle || 'Explore our complete API specifications, modular guides, interactive testing sandbox, and real-time operations.'}
          </p>

          {/* Quick Launch Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={() => onNavigate('/guide')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Developer Guide</span>
            </button>

            <button
              onClick={() => onNavigate('/docs')}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs shadow-xs flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span>Swagger UI Sandbox</span>
            </button>

            <button
              onClick={() => onNavigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs shadow-xs flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>System Health</span>
            </button>

            <a
              href="/docs/swagger.json"
              download="swagger.json"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>OpenAPI Spec</span>
            </a>
          </div>
        </div>
      </section>

      {/* Real-Time Live Statistics Counters */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">REST Endpoints</span>
            <Box className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">
              {stats.totalEndpoints || 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Live defined operations</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Engine Domains</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 font-mono">
              {stats.totalTags || 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Categorized services</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data Models</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-amber-600 font-mono">
              {stats.totalSchemas || 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">JSON Schema structures</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OpenAPI Version</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-sky-600 font-mono">
              {stats.version || '3.0.3'}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Standard OAS specification</div>
          </div>
        </div>
      </section>

      {/* HTTP Method Breakdown Strip */}
      {stats.totalEndpoints > 0 && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-indigo-500" />
            HTTP Methods Breakdown:
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stats.methods.GET > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                GET: {stats.methods.GET}
              </span>
            )}
            {stats.methods.POST > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                POST: {stats.methods.POST}
              </span>
            )}
            {stats.methods.PUT > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                PUT: {stats.methods.PUT}
              </span>
            )}
            {stats.methods.DELETE > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                DELETE: {stats.methods.DELETE}
              </span>
            )}
            {stats.methods.PATCH > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                PATCH: {stats.methods.PATCH}
              </span>
            )}
          </div>
        </section>
      )}

      {/* View Switcher Tabs (README.md vs Live Domain Explorer) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('readme')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'readme'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Project README.md</span>
          </button>

          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'endpoints'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Realtime Domain & Endpoint Explorer ({stats.totalTags})</span>
          </button>
        </div>

        {/* Confidential Redaction Toggle in README View */}
        {activeTab === 'readme' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMaskConfidential(!maskConfidential)}
              title="Toggle Masking of API Secrets, JWT Tokens, and Passwords in README"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                maskConfidential
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {maskConfidential ? (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secrets Masked (Safe Mode)</span>
                  <EyeOff className="w-3 h-3 text-emerald-600 ml-1" />
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>Showing Raw Secrets</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: Render GitHub-Style README.md Container */}
      {activeTab === 'readme' && (
        <section className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          {/* GitHub-Style File Header */}
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="font-mono text-xs font-bold text-slate-800">README.md</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {readmeContent ? `${readmeContent.split('\n').length} lines` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sanitizedReadmeText);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{copiedCode ? 'Copied Markdown!' : 'Copy Raw'}</span>
              </button>
            </div>
          </div>

          {/* Markdown Body */}
          <div className="p-6 sm:p-10">
            {readmeLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium animate-pulse">
                Loading documentation from README.md...
              </div>
            ) : (
              <article
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parsedReadmeHtml }}
              />
            )}
          </div>
        </section>
      )}

      {/* TAB 2: Realtime Domain & Endpoint Explorer */}
      {activeTab === 'endpoints' && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Select an engine domain to jump into Sandbox:
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter services..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTags.map((tag) => (
              <div
                key={tag.name}
                onClick={() => onNavigate(`/docs?module=${encodeURIComponent(tag.name)}`)}
                className="bg-white border border-slate-200/80 hover:border-indigo-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-sm">
                      {tag.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                      {tag.count} endpoints
                    </span>
                  </div>

                  {tag.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {tag.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {Object.entries(tag.methods)
                      .filter(([_, count]) => count > 0)
                      .map(([method, count]) => (
                        <span
                          key={method}
                          className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-slate-100 text-slate-700"
                        >
                          {method} ({count})
                        </span>
                      ))}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
