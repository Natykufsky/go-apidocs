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
  ChevronRight,
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
  const [activeTab, setActiveTab] = useState<'services' | 'readme' | 'endpoints'>('services');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState<boolean>(true);
  const [spec, setSpec] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [maskConfidential, setMaskConfidential] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

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
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Hero Section - Balanced Compact Layout */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-900 text-white pt-8 pb-10 px-4 sm:px-6 lg:px-8 border-b border-slate-800 shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/15 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                <span>{activeWs?.icon || '📁'}</span>
                <span>Workspace: {activeWs?.name || 'Default Workspace'}</span>
                {stats.version && <span className="text-indigo-400 font-mono">v{stats.version}</span>}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                {stats.infoTitle || config.title || 'API Documentation Hub'}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed line-clamp-2">
                {stats.infoDescription ||
                  config.subtitle ||
                  'Unified microservices portal, interactive Swagger testing sandbox, and automated OWASP cybersecurity verification.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/docs')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch API Sandbox</span>
                </button>

                {securityAuditEnabled && onOpenSecurityAudit && (
                  <button
                    type="button"
                    onClick={onOpenSecurityAudit}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Run Security Audit</span>
                  </button>
                )}

                {writesEnabled && onOpenImporter && (
                  <button
                    type="button"
                    onClick={onOpenImporter}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <span>Import API Spec</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto shrink-0">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md">
                <div className="text-2xl font-black text-white">{activeWs?.services?.length || 1}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Services</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md">
                <div className="text-2xl font-black text-indigo-400">{stats.totalEndpoints}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Endpoints</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md">
                <div className="text-2xl font-black text-emerald-400">{stats.totalTags}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Modules</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-md">
                <div className="text-2xl font-black text-amber-400">{stats.totalSchemas}</div>
                <div className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Schemas</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-1.5 flex items-center justify-between gap-2 mb-8">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Workspace Services ({activeWs?.services?.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('readme')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'readme'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Developer Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('endpoints')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'endpoints'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Endpoints ({stats.totalEndpoints})</span>
            </button>
          </div>

          {activeTab === 'readme' && (
            <button
              type="button"
              onClick={() => setMaskConfidential(!maskConfidential)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors mr-1 cursor-pointer"
              title="Toggle Masking Sensitive Secrets"
            >
              {maskConfidential ? <EyeOff className="w-3.5 h-3.5 text-indigo-600" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{maskConfidential ? 'Secrets Masked' : 'Unmasked'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Workspace Services Grid */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {activeWs?.name || 'Workspace'} Microservices
                </h2>
                <p className="text-xs text-slate-600">
                  Select an API to inspect endpoints, run tests in the sandbox, or execute security audits.
                </p>
              </div>

              {writesEnabled && onOpenImporter && (
                <button
                  type="button"
                  onClick={onOpenImporter}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
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
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/10'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg">
                            {svc.icon || '⚡'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">{svc.title}</h3>
                            <span className="text-[10px] text-slate-600 font-mono">
                              v{svc.version || '1.0.0'} • {svc.id}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold uppercase">
                            Active
                          </span>
                        )}
                      </div>

                      {svc.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{svc.description}</p>
                      )}
                    </div>

                    {/* Service Launch Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          onNavigate('/docs');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Sandbox</span>
                      </button>

                      {securityAuditEnabled && onOpenSecurityAudit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectService) onSelectService(activeWs.id, svc.id);
                            onOpenSecurityAudit();
                          }}
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                          title="Run Security Audit"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectService) onSelectService(activeWs.id, svc.id);
                          setActiveTab('readme');
                        }}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                        title="View Documentation"
                      >
                        <BookOpen className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add New API Card */}
              {writesEnabled && onOpenImporter && (
                <div
                  onClick={onOpenImporter}
                  className="rounded-2xl p-6 border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center text-center cursor-pointer group min-h-[160px]"
                >
                  <Plus className="w-8 h-8 text-slate-600 group-hover:text-indigo-600 mb-2 transition-transform group-hover:scale-110" />
                  <div className="text-xs font-bold text-slate-800">Register Another API Spec</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Upload JSON/YAML or fetch URL</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Developer Guide Markdown */}
        {activeTab === 'readme' && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-sm">
            {readmeLoading ? (
              <div className="py-20 text-center text-xs font-bold text-slate-600">Loading documentation guide...</div>
            ) : (
              <div
                className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-indigo-600"
                dangerouslySetInnerHTML={{ __html: processedReadmeHtml }}
              />
            )}
          </div>
        )}

        {/* Tab 3: Endpoints Breakdown */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 flex items-center gap-3">
              <Search className="w-4 h-4 text-slate-600" />
              <input
                type="text"
                placeholder="Filter endpoints by tag or path..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full text-xs text-slate-900 placeholder-slate-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.tagStats
                .filter((t) => t.name.toLowerCase().includes(tagFilter.toLowerCase()))
                .map((tag) => (
                  <div key={tag.name} className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{tag.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-700">
                        {tag.count} operations
                      </span>
                    </div>
                    {tag.description && <p className="text-[11px] text-slate-600">{tag.description}</p>}
                    <div className="flex gap-1 pt-1">
                      {Object.entries(tag.methods).map(([m, count]) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-700">
                          {m}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
