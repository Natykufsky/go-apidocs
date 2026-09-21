import React, { useState, useEffect, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { QABar, QAStats } from './QABar';
import { QARecord } from './QAReportModal';
import { StoredCredentials } from './CredentialManagerModal';
import { Filter, FlaskConical, FileSpreadsheet, KeyRound, CheckCircle2, X } from 'lucide-react';

interface SwaggerSandboxViewProps {
  specUrl: string;
  activeModule: string;
  onModuleChange: (mod: string) => void;
  availableModules: string[];
  qaMode: boolean;
  onToggleQAMode: () => void;
  onOpenQAReport: () => void;
  onInspectEndpoint?: (endpoint: string) => void;
  qaStats: QAStats;
  qaData: Record<string, QARecord>;
  onUpdateQAData: (data: Record<string, QARecord>) => void;
  credentials: StoredCredentials;
  onUpdateCredentials: (creds: StoredCredentials) => void;
  onOpenCredentials: () => void;
}

export const SwaggerSandboxView: React.FC<SwaggerSandboxViewProps> = ({
  specUrl,
  activeModule,
  onModuleChange,
  availableModules,
  qaMode,
  onToggleQAMode,
  onOpenQAReport,
  onInspectEndpoint,
  qaStats,
  qaData,
  onUpdateQAData,
  credentials,
  onUpdateCredentials,
  onOpenCredentials,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sleek in-endpoint QA Button & Note Snippet Injection
  useEffect(() => {
    const injectQAPills = () => {
      const swaggerRoot = containerRef.current;
      if (!swaggerRoot) return;

      const opblocks = swaggerRoot.querySelectorAll('.opblock');
      opblocks.forEach((block) => {
        const methodEl = block.querySelector('.opblock-summary-method');
        const pathEl = block.querySelector('.opblock-summary-path');
        const summaryEl = block.querySelector('.opblock-summary');
        if (!methodEl || !pathEl || !summaryEl) return;

        const method = methodEl.textContent?.trim().toUpperCase() || '';
        const path = pathEl.getAttribute('data-path') || pathEl.textContent?.trim() || '';
        const endpointKey = `${method} ${path}`;

        const itemData = qaData[endpointKey] || {
          status: 'untested',
          comment: '',
          tested_at: '',
        };

        // Check if pill already exists
        const existingPills = summaryEl.querySelectorAll('.qa-pill-trigger');
        if (existingPills.length > 1) {
          for (let i = 1; i < existingPills.length; i++) {
            existingPills[i].remove();
          }
        }

        let pill = (existingPills[0] as HTMLDivElement) || null;

        const getStatusBadgeHtml = (status: string, comment: string) => {
          let badgeClass = 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200';
          let label = '⚪ QA';
          if (status === 'passed') {
            badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
            label = '🟢 Passed';
          } else if (status === 'retest') {
            badgeClass = 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100';
            label = '🟡 Retest';
          } else if (status === 'failed') {
            badgeClass = 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100';
            label = '🔴 Bug / Failed';
          }

          const hasComment = !!comment;
          const commentSnippet = hasComment
            ? `<span class="qa-note-snippet" title="${comment.replace(/"/g, '&quot;')}" style="font-size: 11px; max-width: 140px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; color: #64748b; font-weight: 500; margin-left: 6px; display: inline-block;">💬 ${comment}</span>`
            : '';

          return `
            <div style="display: flex; align-items: center; margin-right: 12px;" onclick="event.stopPropagation();">
              <button type="button" class="qa-pill-btn ${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; border-width: 1px; border-style: solid; cursor: pointer; transition: all 0.15s ease;">
                <span>${label}</span>
              </button>
              ${commentSnippet}
            </div>
          `;
        };

        if (!pill) {
          pill = document.createElement('div');
          pill.className = 'qa-pill-trigger';
          pill.style.display = qaMode ? 'flex' : 'none';
          pill.innerHTML = getStatusBadgeHtml(itemData.status, itemData.comment);

          // Click handler to open QA Inspect Modal
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onInspectEndpoint) {
              onInspectEndpoint(endpointKey);
            }
          });

          // Insert right before the expand arrow button in swagger summary
          const arrowBtn = summaryEl.querySelector('.opblock-summary-control');
          if (arrowBtn) {
            summaryEl.insertBefore(pill, arrowBtn);
          } else {
            summaryEl.appendChild(pill);
          }
        } else {
          // Update pill visibility and content
          pill.style.display = qaMode ? 'flex' : 'none';
          pill.innerHTML = getStatusBadgeHtml(itemData.status, itemData.comment);
        }
      });
    };

    const timeout = setTimeout(injectQAPills, 250);
    const observer = new MutationObserver(() => {
      injectQAPills();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [qaMode, qaData, specUrl, onInspectEndpoint]);

  // Request Interceptor: Attach stored tokens, tenant ID, entity ID & custom headers
  const handleRequestInterceptor = (req: any) => {
    if (!req.headers) {
      req.headers = {};
    }

    const { accessToken, refreshToken, tenantId, entityId, customHeaders } = credentials;

    // Attach Access Token as Bearer if not already set
    if (accessToken && !req.headers['Authorization'] && !req.headers['authorization']) {
      req.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Attach Tenant ID header
    if (tenantId && !req.headers['X-Tenant-ID'] && !req.headers['x-tenant-id']) {
      req.headers['X-Tenant-ID'] = tenantId;
    }

    // Attach Entity ID header
    if (entityId && !req.headers['X-Entity-ID'] && !req.headers['x-entity-id']) {
      req.headers['X-Entity-ID'] = entityId;
    }

    // Attach Refresh Token header
    if (refreshToken && !req.headers['X-Refresh-Token'] && !req.headers['x-refresh-token']) {
      req.headers['X-Refresh-Token'] = refreshToken;
    }

    // Attach any user-defined Custom Headers
    if (customHeaders) {
      Object.entries(customHeaders).forEach(([k, v]) => {
        if (k && v && !req.headers[k]) {
          req.headers[k] = v;
        }
      });
    }

    return req;
  };

  // Response Interceptor: Automatically detect & extract login tokens / tenant credentials
  const handleResponseInterceptor = (res: any) => {
    if (res && (res.status === 200 || res.status === 201) && res.data) {
      try {
        const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        if (body && typeof body === 'object') {
          const candidate = body.data || body.payload || body.result || body;

          const detectedAccessToken =
            candidate.access_token ||
            candidate.accessToken ||
            candidate.token ||
            candidate.jwt ||
            candidate.bearer_token;

          const detectedRefreshToken =
            candidate.refresh_token ||
            candidate.refreshToken;

          const detectedTenantId =
            candidate.tenant_id ||
            candidate.tenantId ||
            candidate.tenant;

          const detectedEntityId =
            candidate.entity_id ||
            candidate.entityId ||
            candidate.entity;

          if (detectedAccessToken || detectedRefreshToken || detectedTenantId || detectedEntityId) {
            const updated: StoredCredentials = {
              ...credentials,
              accessToken: detectedAccessToken || credentials.accessToken,
              refreshToken: detectedRefreshToken || credentials.refreshToken,
              tenantId: detectedTenantId ? String(detectedTenantId) : credentials.tenantId,
              entityId: detectedEntityId ? String(detectedEntityId) : credentials.entityId,
              updatedAt: new Date().toLocaleTimeString(),
            };

            onUpdateCredentials(updated);

            const capturedList: string[] = [];
            if (detectedAccessToken) capturedList.push('Access Token');
            if (detectedRefreshToken) capturedList.push('Refresh Token');
            if (detectedTenantId) capturedList.push(`Tenant (${detectedTenantId})`);
            if (detectedEntityId) capturedList.push(`Entity (${detectedEntityId})`);

            showToast(`🔐 Auto-Captured & Synced: ${capturedList.join(', ')}`);
          }
        }
      } catch (e) {}
    }
    return res;
  };

  const hasActiveCreds = !!(
    credentials.accessToken ||
    credentials.tenantId ||
    credentials.entityId ||
    (credentials.customHeaders && Object.keys(credentials.customHeaders).length > 0)
  );

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      {/* Toast notification for auto-captured credentials */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl border border-indigo-500/30 flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Streamlined, Minimalist Sub-header Toolbar (No redundant search bar) */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-16 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Scope Module Selector */}
          <div className="flex items-center gap-2">
            {availableModules.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-600 hidden sm:inline">Scope:</span>
                <select
                  value={activeModule}
                  onChange={(e) => onModuleChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer text-xs"
                >
                  <option value="all">🌟 All Endpoints</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right: Actions (Tokens & Headers, QA Mode, QA Report, Import Spec) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Credentials & Tokens Manager */}
            <button
              onClick={onOpenCredentials}
              title="Inspect or map captured tokens and custom headers"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                hasActiveCreds
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 shadow-xs'
                  : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tokens:</span>
              <span className={hasActiveCreds ? 'text-indigo-700 font-black' : 'text-slate-500'}>
                {hasActiveCreds ? 'Active 🔐' : 'None'}
              </span>
              {credentials.tenantId && (
                <span className="hidden md:inline-block px-1.5 py-0.2 rounded bg-indigo-200/60 text-[10px] text-indigo-800">
                  {credentials.tenantId}
                </span>
              )}
            </button>

            {/* QA Suite Mode Toggle */}
            <button
              onClick={onToggleQAMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                qaMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                  : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>QA Mode:</span>
              <span className={qaMode ? 'text-emerald-700 font-black' : 'text-slate-500'}>
                {qaMode ? 'Active' : 'Off'}
              </span>
            </button>

            {/* QA Report */}
            <button
              onClick={onOpenQAReport}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>QA Report</span>
            </button>

            {/* In-Browser OpenAPI Spec File / URL Importer */}
            <label
              title="Import local swagger.json or openapi.json directly into sandbox"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <span>📥 Import Spec</span>
              <input
                type="file"
                accept=".json,.yaml,.yml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const content = event.target?.result as string;
                        JSON.parse(content);
                        const blob = new Blob([content], { type: 'application/json' });
                        const objUrl = URL.createObjectURL(blob);
                        onModuleChange('imported');
                        window.history.replaceState(null, '', '/docs?imported=true');
                        const customEvent = new CustomEvent('apidocs:import_spec', { detail: objUrl });
                        window.dispatchEvent(customEvent);
                      } catch (err) {
                        alert('Invalid OpenAPI/Swagger JSON file.');
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* QA Stats Bar if QA mode is active */}
      {qaMode && <QABar stats={qaStats} />}

      {/* Main Swagger Explorer */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-8 shadow-xs">
          <SwaggerUI
            url={specUrl}
            docExpansion="list"
            persistAuthorization={true}
            displayRequestDuration={true}
            requestInterceptor={handleRequestInterceptor}
            responseInterceptor={handleResponseInterceptor}
          />
        </div>
      </main>
    </div>
  );
};
