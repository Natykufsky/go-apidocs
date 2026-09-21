import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Code2,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { StoredCredentials } from './CredentialManagerModal';

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

export const GuideView: React.FC<GuideViewProps> = ({ specUrl, title, credentials = {} }) => {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [activeEndpointKey, setActiveEndpointKey] = useState<string>('');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'go' | 'node' | 'python'>('curl');
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch OpenAPI spec JSON
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

  // Parse all endpoints from spec
  const { endpoints, tags } = useMemo(() => {
    if (!spec || !spec.paths) return { endpoints: [], tags: [] };

    const epList: EndpointDoc[] = [];
    const tagSet = new Set<string>();

    for (const path in spec.paths) {
      const pathItem = spec.paths[path];
      for (const method in pathItem) {
        const upperM = method.toUpperCase();
        if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(upperM)) {
          const op = pathItem[method];
          const opTags: string[] = op.tags && op.tags.length > 0 ? op.tags : ['General'];
          opTags.forEach((t) => tagSet.add(t));

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

    return {
      endpoints: epList,
      tags: Array.from(tagSet),
    };
  }, [spec]);

  // Auto-select first endpoint
  useEffect(() => {
    if (endpoints.length > 0 && !activeEndpointKey) {
      setActiveEndpointKey(`${endpoints[0].method} ${endpoints[0].path}`);
    }
  }, [endpoints, activeEndpointKey]);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      const matchesSearch =
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.summary?.toLowerCase().includes(search.toLowerCase()) ||
        ep.method.toLowerCase().includes(search.toLowerCase());
      const matchesTag = selectedTag === 'all' || ep.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [endpoints, search, selectedTag]);

  const activeEndpoint = useMemo(() => {
    return endpoints.find((ep) => `${ep.method} ${ep.path}` === activeEndpointKey) || endpoints[0];
  }, [endpoints, activeEndpointKey]);

  // Generate multi-language code snippets
  const generateSnippet = (ep: EndpointDoc | undefined, lang: string): string => {
    if (!ep) return '';

    const host = window.location.origin;
    const fullUrl = `${host}${ep.path}`;
    const token = credentials.accessToken ? `Bearer ${credentials.accessToken}` : 'Bearer <YOUR_TOKEN>';
    const tenant = credentials.tenantId ? credentials.tenantId : '<TENANT_ID>';

    switch (lang) {
      case 'curl': {
        let cmd = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Authorization: ${token}" \\\n  -H "X-Tenant-ID: ${tenant}" \\\n  -H "Content-Type: application/json"`;
        if (ep.method === 'POST' || ep.method === 'PUT' || ep.method === 'PATCH') {
          cmd += ` \\\n  -d '{\n    "example": "value"\n  }'`;
        }
        return cmd;
      }
      case 'go': {
        return `package main

import (
	"fmt"
	"net/http"
	"io"
)

func main() {
	url := "${fullUrl}"
	req, _ := http.NewRequest("${ep.method}", url, nil)
	req.Header.Set("Authorization", "${token}")
	req.Header.Set("X-Tenant-ID", "${tenant}")
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	fmt.Println(string(body))
}`;
      }
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

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'PUT':
        return 'bg-amber-500/10 text-amber-700 border-amber-200';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-700 border-rose-200';
      case 'PATCH':
        return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-32 bg-slate-50">
        <div className="text-center space-y-3">
          <BookOpen className="w-8 h-8 text-indigo-600 animate-pulse mx-auto" />
          <div className="text-xs font-bold text-slate-700">Loading Native Developer Guide...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 min-h-[calc(100vh-4rem)]">
      {/* 3-Column Modern Developer Reference Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Column 1: Sidebar Endpoint Navigator */}
        <aside className="w-full lg:w-72 shrink-0 bg-white rounded-3xl border border-slate-200/90 p-4 shadow-2xs flex flex-col max-h-[85vh]">
          {/* Search & Tag Filter */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-500 outline-none"
              />
            </div>

            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">🌟 All Modules ({endpoints.length})</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    📁 {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Endpoints List */}
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredEndpoints.map((ep) => {
              const key = `${ep.method} ${ep.path}`;
              const isSelected = key === activeEndpointKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveEndpointKey(key)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-200/80 text-indigo-950 font-bold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${getMethodBadgeClass(
                        ep.method
                      )}`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs truncate">{ep.path}</span>
                  </div>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />}
                </button>
              );
            })}

            {filteredEndpoints.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">No matching endpoints found</div>
            )}
          </div>
        </aside>

        {/* Column 2: Endpoint Deep Dive & Specifications */}
        <main className="flex-1 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs overflow-y-auto max-h-[85vh] space-y-6">
          {activeEndpoint ? (
            <>
              {/* Endpoint Header */}
              <div className="space-y-3 pb-6 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border ${getMethodBadgeClass(
                      activeEndpoint.method
                    )}`}
                  >
                    {activeEndpoint.method}
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-900">
                    {activeEndpoint.path}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {activeEndpoint.summary}
                </h2>

                {activeEndpoint.description && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {activeEndpoint.description}
                  </p>
                )}
              </div>

              {/* Parameters Table */}
              {activeEndpoint.parameters && activeEndpoint.parameters.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Request Parameters ({activeEndpoint.parameters.length})
                  </h3>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">Name</th>
                          <th className="p-3">In</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Required</th>
                          <th className="p-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {activeEndpoint.parameters.map((param: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-indigo-700">{param.name}</td>
                            <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{param.in}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">{param.schema?.type || param.type || 'string'}</td>
                            <td className="p-3">
                              {param.required ? (
                                <span className="text-[10px] font-bold text-rose-600">Required</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Optional</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600">{param.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Response Codes */}
              {activeEndpoint.responses && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Responses</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(activeEndpoint.responses).map(([code, resp]: [string, any]) => (
                      <div
                        key={code}
                        className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
                          code.startsWith('2')
                            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            code.startsWith('2') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {code}
                        </span>
                        <div className="text-xs font-medium">{resp.description || 'Response'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-xs text-slate-500">Select an endpoint to view documentation</div>
          )}
        </main>

        {/* Column 3: Pre-Authenticated Multi-Language Code Snippets */}
        <aside className="w-full lg:w-96 shrink-0 bg-slate-900 text-white rounded-3xl border border-slate-800 p-5 shadow-xl flex flex-col max-h-[85vh]">
          {/* Header & Language Selector */}
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Code Snippets</span>
            </div>

            <div className="flex bg-slate-800 p-1 rounded-xl gap-0.5">
              {(['curl', 'go', 'node', 'python'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSnippetLang(lang)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                    snippetLang === lang ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 relative rounded-2xl bg-slate-950 p-4 border border-slate-800/80 overflow-y-auto font-mono text-xs text-indigo-300 leading-relaxed">
            <pre className="whitespace-pre-wrap break-all">{generateSnippet(activeEndpoint, snippetLang)}</pre>
          </div>

          {/* Copy Button */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              {credentials.accessToken ? '🔐 Auth Token Attached' : 'Bearer <token> placeholder'}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(generateSnippet(activeEndpoint, snippetLang))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
