import React, { useState, useEffect, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { QABar, QAStats } from './QABar';
import { QARecord } from './QAReportModal';
import { StoredCredentials } from './CredentialManagerModal';
import { Filter, FlaskConical, FileSpreadsheet, KeyRound, CheckCircle2, X, ShieldAlert, Flame } from 'lucide-react';

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
  maskPII?: boolean;
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
  maskPII = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning'>('success');

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // In-endpoint QA Button & Note Snippet Injection
  useEffect(() => {
    let isInjecting = false;
    const injectQAPills = () => {
      if (isInjecting) return;
      const swaggerRoot = containerRef.current;
      if (!swaggerRoot) return;

      isInjecting = true;
      try {
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

          const existingPills = summaryEl.querySelectorAll('.qa-pill-trigger');
          if (existingPills.length > 1) {
            for (let i = 1; i < existingPills.length; i++) {
              existingPills[i].remove();
            }
          }

          let pill = (existingPills[0] as HTMLDivElement) || null;

          const getStatusBadgeHtml = (status: string, comment: string) => {
            let badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200';
            let label = '⚪ QA';
            if (status === 'passed') {
              badgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100';
              label = '🟢 Passed';
            } else if (status === 'retest') {
              badgeClass = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100';
              label = '🟡 Retest';
            } else if (status === 'failed') {
              badgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100';
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

            pill.addEventListener('click', (e) => {
              e.stopPropagation();
              if (onInspectEndpoint) {
                onInspectEndpoint(endpointKey);
              }
            });

            const arrowBtn = summaryEl.querySelector('.opblock-summary-control');
            if (arrowBtn) {
              summaryEl.insertBefore(pill, arrowBtn);
            } else {
              summaryEl.appendChild(pill);
            }
          } else {
            pill.style.display = qaMode ? 'flex' : 'none';
            pill.innerHTML = getStatusBadgeHtml(itemData.status, itemData.comment);
          }
        });
      } finally {
        setTimeout(() => {
          isInjecting = false;
        }, 100);
      }
    };

    let debounceTimer: any = null;
    const debouncedInject = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(injectQAPills, 150);
    };

    const timeout = setTimeout(injectQAPills, 300);
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations generated by our own QA pill triggers
      const isInternal = mutations.every(
        (m) =>
          (m.target as HTMLElement)?.classList?.contains('qa-pill-trigger') ||
          (m.target as HTMLElement)?.classList?.contains('qa-pill-btn') ||
          (m.target as HTMLElement)?.closest?.('.qa-pill-trigger')
      );
      if (!isInternal) {
        debouncedInject();
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      clearTimeout(timeout);
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [qaMode, qaData, specUrl, onInspectEndpoint]);

  // Request Interceptor
  const handleRequestInterceptor = (req: any) => {
    if (!req.headers) {
      req.headers = {};
    }

    const { accessToken, refreshToken, tenantId, entityId, customHeaders } = credentials;

    if (accessToken && !req.headers['Authorization'] && !req.headers['authorization']) {
      req.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (tenantId && !req.headers['X-Tenant-ID'] && !req.headers['x-tenant-id']) {
      req.headers['X-Tenant-ID'] = tenantId;
    }
    if (entityId && !req.headers['X-Entity-ID'] && !req.headers['x-entity-id']) {
      req.headers['X-Entity-ID'] = entityId;
    }
    if (refreshToken && !req.headers['X-Refresh-Token'] && !req.headers['x-refresh-token']) {
      req.headers['X-Refresh-Token'] = refreshToken;
    }
    if (customHeaders) {
      Object.entries(customHeaders).forEach(([k, v]) => {
        if (k && v && !req.headers[k]) {
          req.headers[k] = v;
        }
      });
    }

    return req;
  };

  // Response Interceptor: Auto-capture tokens & detect PII / sensitive data leaks
  const handleResponseInterceptor = (res: any) => {
    if (res && res.data) {
      try {
        const rawStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

        // Security / PII Leak checks
        if (/AKIA[0-9A-Z]{16}/.test(rawStr)) {
          showToast('⚠️ Security Alert: Potential AWS Access Key leaked in response payload!', 'warning');
        } else if (/-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/.test(rawStr)) {
          showToast('🚨 Critical Security Alert: Private Key detected in response payload!', 'warning');
        } else if (/(sql:\s*no\s*rows|pq:\s*relation|syntax\s*error\s*at\s*or\s*near)/i.test(rawStr)) {
          showToast('⚠️ Debug Info Leak: Database query error/stack trace exposed in response.', 'warning');
        }

        // Auto token and credential capture
        if (res.status === 200 || res.status === 201) {
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

              showToast(`🔐 Auto-Captured & Synced: ${capturedList.join(', ')}`, 'success');
            }
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
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-bottom-5 ${
            toastType === 'warning'
              ? 'bg-amber-950/95 text-amber-100 border-amber-500/50'
              : 'bg-slate-900/95 text-white border-indigo-500/30'
          }`}
        >
          {toastType === 'warning' ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-header Toolbar */}
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

          {/* Right: Actions */}
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
          </div>
        </div>
      </div>

      {/* QA Stats Bar */}
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
