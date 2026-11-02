import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Play,
  X,
  FileJson,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { StoredCredentials } from './CredentialManagerModal';
import { useAuth } from '../context/AuthContext';

interface GuideViewProps {
  specUrl: string;
  title?: string;
  credentials?: StoredCredentials;
}

interface EndpointDoc {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  operationId?: string;
}

/* ---------- method pill helper ---------- */
const methodPill = (m: string): React.CSSProperties => {
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    GET: {
      bg: 'color-mix(in srgb, var(--info-500) 12%, transparent)',
      fg: 'var(--info-500)',
      bd: 'color-mix(in srgb, var(--info-500) 26%, transparent)',
    },
    POST: {
      bg: 'color-mix(in srgb, var(--success-500) 12%, transparent)',
      fg: 'var(--success-500)',
      bd: 'color-mix(in srgb, var(--success-500) 26%, transparent)',
    },
    PUT: {
      bg: 'color-mix(in srgb, var(--warning-500) 12%, transparent)',
      fg: 'var(--warning-500)',
      bd: 'color-mix(in srgb, var(--warning-500) 26%, transparent)',
    },
    PATCH: {
      bg: 'color-mix(in srgb, var(--warning-500) 12%, transparent)',
      fg: 'var(--warning-500)',
      bd: 'color-mix(in srgb, var(--warning-500) 26%, transparent)',
    },
    DELETE: {
      bg: 'color-mix(in srgb, var(--danger-500) 12%, transparent)',
      fg: 'var(--danger-500)',
      bd: 'color-mix(in srgb, var(--danger-500) 26%, transparent)',
    },
  };
  const c = map[m] || {
    bg: 'var(--bg-overlay)',
    fg: 'var(--text-secondary)',
    bd: 'var(--border-subtle)',
  };
  return {
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.bd}`,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '2px 6px',
    borderRadius: 4,
    textTransform: 'uppercase' as const,
    lineHeight: 1.4,
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
  };
};

/* ---------- error code pill ---------- */
const statusPill = (code: string): React.CSSProperties => {
  const s = code.startsWith('2')
    ? { bg: 'color-mix(in srgb, var(--success-500) 12%, transparent)', fg: 'var(--success-500)' }
    : code.startsWith('4')
    ? { bg: 'color-mix(in srgb, var(--warning-500) 12%, transparent)', fg: 'var(--warning-500)' }
    : code.startsWith('5')
    ? { bg: 'color-mix(in srgb, var(--danger-500) 12%, transparent)', fg: 'var(--danger-500)' }
    : { bg: 'var(--bg-overlay)', fg: 'var(--text-secondary)' };
  return {
    background: s.bg,
    color: s.fg,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 4,
    lineHeight: 1.4,
    flexShrink: 0,
  };
};

export const GuideView: React.FC<GuideViewProps> = ({ specUrl, title, credentials = {} }) => {
  const { isExpiringSoon, isExpired, refreshAccessToken, isRefreshing } = useAuth();
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeEndpointKey, setActiveEndpointKey] = useState<string>('');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'go' | 'node' | 'python'>('curl');
  const [copied, setCopied] = useState<boolean>(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(specUrl)
      .then((res) => res.json())
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [specUrl]);

  const { endpoints, tags } = useMemo(() => {
    if (!spec || !spec.paths) return { endpoints: [], tags: [] as string[] };

    const declaredTags: string[] = Array.isArray(spec.tags)
      ? spec.tags.map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : [];

    const tagOrderMap = new Map<string, number>();
    declaredTags.forEach((name, idx) => tagOrderMap.set(name, idx));

    const epList: EndpointDoc[] = [];
    const extraTagsSet = new Set<string>();

    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      for (const method in pathItem) {
        const upperM = method.toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(upperM)) {
          const op = pathItem[method];
          const opTags: string[] = op.tags && op.tags.length > 0 ? op.tags : ['General'];
          opTags.forEach((t) => {
            if (!tagOrderMap.has(t)) extraTagsSet.add(t);
          });

          epList.push({
            method: upperM,
            path,
            summary: op.summary || `${upperM} ${path}`,
            description: op.description,
            tags: opTags,
            parameters: op.parameters || [],
            requestBody: op.requestBody,
            responses: op.responses || {},
            operationId: op.operationId,
          });
        }
      }
    }

    const extraTags = Array.from(extraTagsSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    const allTags = [...declaredTags, ...extraTags];
    allTags.forEach((name, idx) => tagOrderMap.set(name, idx));

    epList.sort((a, b) => {
      const tagA = a.tags[0] || 'General';
      const tagB = b.tags[0] || 'General';
      const orderA = tagOrderMap.has(tagA) ? tagOrderMap.get(tagA)! : 9999;
      const orderB = tagOrderMap.has(tagB) ? tagOrderMap.get(tagB)! : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.path.localeCompare(b.path);
    });

    return { endpoints: epList, tags: allTags };
  }, [spec]);

  useEffect(() => {
    if (endpoints.length > 0 && !activeEndpointKey) {
      setActiveEndpointKey(`${endpoints[0].method} ${endpoints[0].path}`);
    }
  }, [endpoints, activeEndpointKey]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const q = search.toLowerCase();
      const matchesSearch =
        ep.path.toLowerCase().includes(q) ||
        ep.summary?.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q);
      const matchesTag = selectedTag === 'all' || ep.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [endpoints, search, selectedTag]);

  const activeEndpoint = useMemo(() => {
    return (
      endpoints.find((ep) => `${ep.method} ${ep.path}` === activeEndpointKey) || endpoints[0]
    );
  }, [endpoints, activeEndpointKey]);

  const generateSnippet = (ep: EndpointDoc | undefined, lang: string): string => {
    if (!ep) return '';

    const host = window.location.origin;
    const fullUrl = `${host}${ep.path}`;
    const token = credentials.accessToken
      ? `Bearer ${credentials.accessToken}`
      : 'Bearer <YOUR_TOKEN>';
    const tenant = credentials.tenantId ? credentials.tenantId : '<TENANT_ID>';
    const refreshHdr = credentials.refreshToken;
    const customHdrs = credentials.customHeaders || {};

    switch (lang) {
      case 'curl': {
        let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Authorization: ${token}" \\\n  -H "X-Tenant-ID: ${tenant}"`;
        if (refreshHdr) cmd += ` \\\n  -H "X-Refresh-Token: ${refreshHdr}"`;
        Object.entries(customHdrs).forEach(([k, v]) => {
          if (k && v) cmd += ` \\\n  -H "${k}: ${v}"`;
        });
        cmd += ` \\\n  -H "Content-Type: application/json"`;
        if (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH') {
          cmd += ` \\\n  -d '{\n    "example": "value"\n  }'`;
        }
        return cmd;
      }
      case 'go':
        return `package main

import (
\t"fmt"
\t"net/http"
\t"io"
)

func main() {
\turl := "${fullUrl}"
\treq, _ := http.NewRequest("${ep.method}", url, nil)
\treq.Header.Set("Authorization", "${token}")
\treq.Header.Set("X-Tenant-ID", "${tenant}")
\treq.Header.Set("Content-Type", "application/json")

\tres, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer res.Body.Close()

\tbody, _ := io.ReadAll(res.Body)
\tfmt.Println(string(body))
}`;
      case 'node': {
        let code = `const url = '${fullUrl}';\n\nconst options = {\n  method: '${ep.method}',\n  headers: {\n    'Authorization': '${token}',\n    'X-Tenant-ID': '${tenant}',\n    'Content-Type': 'application/json'\n  }`;
        if (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH') {
          code += `,\n  body: JSON.stringify({\n    example: 'value'\n  })`;
        }
        code += `\n};\n\ntry {\n  const res = await fetch(url, options);\n  const data = await res.json();\n  console.log(data);\n} catch (err) {\n  console.error(err);\n}`;
        return code;
      }
      case 'python': {
        let code = `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Authorization": "${token}",\n    "X-Tenant-ID": "${tenant}",\n    "Content-Type": "application/json"\n}\n`;
        if (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH') {
          code += `payload = {"example": "value"}\n\nresponse = requests.${ep.method.toLowerCase()}(url, json=payload, headers=headers)\n`;
        } else {
          code += `response = requests.${ep.method.toLowerCase()}(url, headers=headers)\n`;
        }
        code += `print(response.json())`;
        return code;
      }
      default:
        return '';
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ---------- loading ---------- */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="text-center space-y-3">
          <Loader2
            className="w-6 h-6 animate-spin mx-auto"
            style={{ color: 'var(--accent-500)' }}
          />
          <div className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Loading developer reference…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-canvas)' }}>
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ============================================================
              COLUMN 1 — Navigator
              ============================================================ */}
          <aside
            className="w-full lg:w-[280px] shrink-0 flex flex-col lg:sticky lg:top-[calc(var(--topbar-h)+16px)] lg:max-h-[calc(100vh-var(--topbar-h)-32px)] rounded-[var(--r-lg)]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* search */}
            <div className="p-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                className="flex items-center gap-2 h-8 px-2.5 rounded-[var(--r-sm)]"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Search
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search endpoints…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[12px]"
                  style={{ color: 'var(--text-primary)' }}
                />
                {search ? (
                  <button
                    onClick={() => setSearch('')}
                    className="shrink-0 p-0.5 rounded"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="kbd shrink-0">⌘K</span>
                )}
              </div>
            </div>

            {/* tag filter pills */}
            {tags.length > 0 && (
              <div
                className="px-3 py-2 flex flex-wrap gap-1"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className="h-6 px-2 rounded text-[11px] font-medium transition-colors"
                  style={
                    selectedTag === 'all'
                      ? {
                          background: 'var(--accent-muted)',
                          color: 'var(--accent-500)',
                          border: '1px solid color-mix(in srgb, var(--accent-500) 22%, transparent)',
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--text-tertiary)',
                          border: '1px solid transparent',
                        }
                  }
                >
                  All · {endpoints.length}
                </button>
                {tags.slice(0, 8).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTag(t)}
                    title={t}
                    className="h-6 px-2 rounded text-[11px] font-medium transition-colors truncate max-w-[140px]"
                    style={
                      selectedTag === t
                        ? {
                            background: 'var(--accent-muted)',
                            color: 'var(--accent-500)',
                            border: '1px solid color-mix(in srgb, var(--accent-500) 22%, transparent)',
                          }
                        : {
                            background: 'var(--bg-canvas)',
                            color: 'var(--text-tertiary)',
                            border: '1px solid var(--border-subtle)',
                          }
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* endpoint list */}
            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredEndpoints.length === 0 && (
                <div
                  className="px-3 py-8 text-center text-[12px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  No endpoints match your filter.
                </div>
              )}

              {filteredEndpoints.map((ep) => {
                const key = `${ep.method} ${ep.path}`;
                const isSelected = key === activeEndpointKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveEndpointKey(key)}
                    title={`${ep.method} ${ep.path}`}
                    className="w-full flex items-center gap-2 h-8 px-2 rounded-[var(--r-sm)] text-left transition-colors mb-0.5"
                    style={
                      isSelected
                        ? {
                            background: 'var(--accent-muted)',
                            color: 'var(--accent-500)',
                            boxShadow: 'inset 3px 0 0 var(--accent-500)',
                          }
                        : { background: 'transparent', color: 'var(--text-secondary)' }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <span style={methodPill(ep.method)}>{ep.method}</span>
                    <span
                      className="mono text-[11.5px] truncate flex-1"
                      style={{ color: 'inherit' }}
                    >
                      {ep.path}
                    </span>
                    {isSelected && (
                      <ChevronRight
                        className="w-3 h-3 shrink-0"
                        style={{ color: 'var(--accent-500)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* footer count */}
            <div
              className="px-3 py-2 text-[11px] mono flex items-center justify-between"
              style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
            >
              <span>{filteredEndpoints.length} of {endpoints.length}</span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {tags.length} modules
              </span>
            </div>
          </aside>

          {/* ============================================================
              COLUMN 2 — Endpoint detail
              ============================================================ */}
          <main
            className="flex-1 min-w-0 rounded-[var(--r-lg)] overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {activeEndpoint ? (
              <>
                {/* header */}
                <div
                  className="p-5 sm:p-6"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      style={{
                        ...methodPill(activeEndpoint.method),
                        fontSize: 11,
                        padding: '3px 8px',
                      }}
                    >
                      {activeEndpoint.method}
                    </span>
                    <span
                      className="mono text-[13px] sm:text-[14px] font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {activeEndpoint.path}
                    </span>
                    {activeEndpoint.operationId && (
                      <span
                        className="mono text-[10.5px] px-1.5 py-0.5 rounded ml-auto"
                        style={{
                          background: 'var(--bg-canvas)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {activeEndpoint.operationId}
                      </span>
                    )}
                  </div>

                  <h1
                    className="text-[18px] sm:text-[20px] font-semibold leading-snug mb-2"
                    style={{ color: 'var(--text-primary)', letterSpacing: '-0.018em' }}
                  >
                    {activeEndpoint.summary}
                  </h1>

                  {activeEndpoint.description && (
                    <p
                      className="text-[13px] leading-relaxed max-w-[680px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {activeEndpoint.description}
                    </p>
                  )}

                  {/* tag pills + try in sandbox */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {activeEndpoint.tags.map((t) => (
                      <span
                        key={t}
                        className="h-5 px-1.5 inline-flex items-center rounded mono text-[10.5px]"
                        style={{
                          background: 'var(--bg-canvas)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    <a
                      href="/docs"
                      className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
                      style={{
                        background: 'var(--accent-500)',
                        color: 'var(--text-inverse)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.4)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-400)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--accent-500)';
                      }}
                    >
                      <Play className="w-3 h-3" />
                      Try in sandbox
                    </a>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-7">
                  {/* Parameters */}
                  {activeEndpoint.parameters.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <h2
                          className="text-[13px] font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Parameters
                        </h2>
                        <span
                          className="h-5 px-1.5 inline-flex items-center rounded mono text-[10.5px]"
                          style={{
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {activeEndpoint.parameters.length}
                        </span>
                      </div>

                      <div
                        className="rounded-[var(--r-md)] overflow-hidden"
                        style={{ border: '1px solid var(--border-subtle)' }}
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-[12px] border-collapse">
                            <thead>
                              <tr style={{ background: 'var(--bg-canvas)' }}>
                                {['Name', 'In', 'Type', 'Required', 'Description'].map((h) => (
                                  <th
                                    key={h}
                                    className="text-left px-3 py-2 font-medium whitespace-nowrap"
                                    style={{
                                      color: 'var(--text-tertiary)',
                                      borderBottom: '1px solid var(--border-subtle)',
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {activeEndpoint.parameters.map((param: any, idx: number) => (
                                <tr
                                  key={idx}
                                  style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none' }}
                                >
                                  <td
                                    className="px-3 py-2 mono text-[11.5px] font-medium whitespace-nowrap"
                                    style={{ color: 'var(--accent-500)' }}
                                  >
                                    {param.name}
                                  </td>
                                  <td
                                    className="px-3 py-2 mono text-[10.5px] uppercase"
                                    style={{ color: 'var(--text-tertiary)' }}
                                  >
                                    {param.in}
                                  </td>
                                  <td
                                    className="px-3 py-2 mono text-[11px]"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    {param.schema?.type || param.type || 'string'}
                                  </td>
                                  <td className="px-3 py-2">
                                    {param.required ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10.5px] font-medium"
                                        style={{ color: 'var(--danger-500)' }}
                                      >
                                        <span
                                          className="w-1 h-1 rounded-full"
                                          style={{ background: 'var(--danger-500)' }}
                                        />
                                        Required
                                      </span>
                                    ) : (
                                      <span
                                        className="text-[10.5px]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                      >
                                        Optional
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-2 leading-relaxed"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    {param.description || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Request body */}
                  {activeEndpoint.requestBody && (
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <h2
                          className="text-[13px] font-semibold"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Request body
                        </h2>
                        {activeEndpoint.requestBody.required && (
                          <span
                            className="h-5 px-1.5 inline-flex items-center rounded text-[10.5px] font-medium"
                            style={{
                              background: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
                              color: 'var(--danger-500)',
                              border: '1px solid color-mix(in srgb, var(--danger-500) 22%, transparent)',
                            }}
                          >
                            required
                          </span>
                        )}
                      </div>
                      <div
                        className="rounded-[var(--r-md)] p-3 mono text-[11.5px] overflow-x-auto"
                        style={{
                          background: 'var(--bg-canvas)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-tertiary)' }}>
                          <FileJson className="w-3 h-3" />
                          application/json
                        </div>
                        {(() => {
                          const content = activeEndpoint.requestBody.content;
                          const schema = content?.['application/json']?.schema;
                          const example =
                            content?.['application/json']?.example ||
                            schema?.example ||
                            schema?.properties
                              ? Object.fromEntries(
                                  Object.entries(schema.properties || {}).map(([k, v]: any) => [
                                    k,
                                    v.example ?? v.type ?? 'value',
                                  ])
                                )
                              : null;
                          return (
                            <pre className="whitespace-pre-wrap break-all">
                              {example ? JSON.stringify(example, null, 2) : schema ? JSON.stringify(schema, null, 2) : '—'}
                            </pre>
                          );
                        })()}
                      </div>
                    </section>
                  )}

                  {/* Responses */}
                  {Object.keys(activeEndpoint.responses).length > 0 && (
                    <section>
                      <h2
                        className="text-[13px] font-semibold mb-3"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        Responses
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(activeEndpoint.responses).map(
                          ([code, resp]: [string, any]) => (
                            <div
                              key={code}
                              className="flex items-start gap-2.5 p-3 rounded-[var(--r-md)]"
                              style={{
                                background: 'var(--bg-canvas)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              <span style={statusPill(code)}>{code}</span>
                              <div
                                className="text-[12px] leading-relaxed min-w-0 flex-1"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {resp.description || 'Response'}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <div className="py-32 text-center">
                <BookOpen
                  className="w-6 h-6 mx-auto mb-3"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <div className="text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
                  Select an endpoint to view its documentation.
                </div>
              </div>
            )}
          </main>

          {/* ============================================================
              COLUMN 3 — Code snippets (always dark — code convention)
              ============================================================ */}
          <aside
            className="w-full lg:w-[380px] shrink-0 flex flex-col lg:sticky lg:top-[calc(var(--topbar-h)+16px)] lg:max-h-[calc(100vh-var(--topbar-h)-32px)] rounded-[var(--r-lg)] overflow-hidden"
            style={{
              background: '#0A0B0D',
              border: '1px solid #23272E',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid #23272E' }}
            >
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" style={{ color: '#22D3EE' }} />
                <span className="text-[11.5px] font-medium" style={{ color: '#A1A1AA' }}>
                  Snippet
                </span>
              </div>
              <div className="flex gap-0.5">
                {(['curl', 'go', 'node', 'python'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSnippetLang(lang)}
                    className="h-6 px-2 rounded text-[10.5px] font-medium uppercase transition-colors"
                    style={
                      snippetLang === lang
                        ? { background: '#1F1F24', color: '#FAFAFA' }
                        : { background: 'transparent', color: '#71717A' }
                    }
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* code */}
            <div
              className="flex-1 overflow-y-auto p-4 mono text-[11.5px] leading-[1.65]"
              style={{ color: '#E8EAED' }}
            >
              <pre className="whitespace-pre-wrap break-all m-0">
                {generateSnippet(activeEndpoint, snippetLang)}
              </pre>
            </div>

            {/* footer */}
            <div
              className="flex items-center justify-between gap-2 px-4 py-2.5"
              style={{ borderTop: '1px solid #23272E' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 text-[10.5px] font-medium"
                  style={{
                    color: credentials.accessToken
                      ? isExpired
                        ? '#F87171'
                        : isExpiringSoon
                          ? '#FBBF24'
                          : '#4ADE80'
                      : '#71717A',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: credentials.accessToken
                        ? isExpired
                          ? '#F87171'
                          : isExpiringSoon
                            ? '#FBBF24'
                            : '#4ADE80'
                        : '#71717A',
                      boxShadow: credentials.accessToken
                        ? '0 0 6px rgba(74,222,128,0.6)'
                        : 'none',
                    }}
                  />
                  {credentials.accessToken
                    ? isExpired
                      ? 'Token expired'
                      : credentials.refreshToken && credentials.autoRefresh !== false
                        ? 'Auto-refresh active'
                        : 'Auth attached'
                    : 'Auth placeholder'}
                </span>
                {credentials.refreshToken && (
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={() => refreshAccessToken()}
                    title="Refresh access token now"
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                    style={{ background: '#1F1F24', color: '#22D3EE' }}
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(generateSnippet(activeEndpoint, snippetLang))}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors"
                style={{
                  background: copied ? '#4ADE80' : '#FAFAFA',
                  color: '#0A0B0D',
                }}
                onMouseEnter={(e) => {
                  if (!copied) e.currentTarget.style.background = '#E4E4E7';
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.background = '#FAFAFA';
                }}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};