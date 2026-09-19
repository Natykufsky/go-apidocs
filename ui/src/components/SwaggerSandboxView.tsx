import React, { useState, useEffect, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { QABar, QAStats } from './QABar';
import { QARecord } from './QAReportModal';
import { Search, Filter, FlaskConical, FileSpreadsheet, X } from 'lucide-react';

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
  onOpenSearch?: () => void;
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
  onOpenSearch,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // QA Panel Injection & DOM Synchronization
  useEffect(() => {
    const injectQAPanels = () => {
      const swaggerRoot = containerRef.current;
      if (!swaggerRoot) return;

      const opblocks = swaggerRoot.querySelectorAll('.opblock');
      opblocks.forEach((block) => {
        const methodEl = block.querySelector('.opblock-summary-method');
        const pathEl = block.querySelector('.opblock-summary-path');
        if (!methodEl || !pathEl) return;

        const method = methodEl.textContent?.trim().toUpperCase() || '';
        const path = pathEl.getAttribute('data-path') || pathEl.textContent?.trim() || '';
        const endpointKey = `${method} ${path}`;

        const itemData = qaData[endpointKey] || {
          status: 'untested',
          comment: '',
          tested_at: '',
        };

        // Check if panel already exists in block (prevent duplicates)
        const existingPanels = block.querySelectorAll('.qa-endpoint-panel');
        if (existingPanels.length > 1) {
          // Remove any extraneous duplicates
          for (let i = 1; i < existingPanels.length; i++) {
            existingPanels[i].remove();
          }
        }

        let panel = (existingPanels[0] as HTMLDivElement) || null;

        if (!panel) {
          panel = document.createElement('div');
          panel.className = `qa-endpoint-panel ${itemData.status}`;
          if (!qaMode) {
            panel.style.display = 'none';
          }

          panel.innerHTML = `
            <div class="qa-panel-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; font-size: 12px; color: #334155;">🧪 QA Status:</span>
                <select class="qa-status-select">
                  <option value="untested" ${itemData.status === 'untested' ? 'selected' : ''}>⚪ Not Tested</option>
                  <option value="passed" ${itemData.status === 'passed' ? 'selected' : ''}>🟢 Passed (Working)</option>
                  <option value="retest" ${itemData.status === 'retest' ? 'selected' : ''}>🟡 Needs Retest</option>
                  <option value="failed" ${itemData.status === 'failed' ? 'selected' : ''}>🔴 Failed / Bug Found</option>
                </select>
              </div>
              <span class="qa-timestamp" style="font-size: 11px; color: #64748b; font-weight: 600;">
                ${itemData.tested_at ? 'Synced: ' + itemData.tested_at : ''}
              </span>
            </div>
            <textarea class="qa-comment-input" placeholder="Leave QA test notes, bug details, status codes, or payload comments here (synced to server)...">${itemData.comment || ''}</textarea>
          `;

          // Event handlers
          const selectEl = panel.querySelector('.qa-status-select') as HTMLSelectElement;
          const textareaEl = panel.querySelector('.qa-comment-input') as HTMLTextAreaElement;

          selectEl.addEventListener('change', async () => {
            const newStatus = selectEl.value as 'passed' | 'retest' | 'failed' | 'untested';
            panel.className = `qa-endpoint-panel ${newStatus}`;
            const timeStr = new Date().toLocaleString();
            const timeEl = panel.querySelector('.qa-timestamp');
            if (timeEl) timeEl.textContent = 'Synced: ' + timeStr;

            const updatedData: Record<string, QARecord> = {
              ...qaData,
              [endpointKey]: {
                status: newStatus,
                comment: textareaEl.value,
                tested_at: timeStr,
              },
            };
            onUpdateQAData(updatedData);

            try {
              await fetch('/docs/qa/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint: endpointKey,
                  endpoint_key: endpointKey,
                  status: newStatus,
                  comment: textareaEl.value,
                }),
              });
            } catch (err) {}
          });

          textareaEl.addEventListener('blur', async () => {
            const timeStr = new Date().toLocaleString();
            const statusVal = selectEl.value as 'passed' | 'retest' | 'failed' | 'untested';
            const updatedData: Record<string, QARecord> = {
              ...qaData,
              [endpointKey]: {
                status: statusVal,
                comment: textareaEl.value,
                tested_at: timeStr,
              },
            };
            onUpdateQAData(updatedData);

            try {
              await fetch('/docs/qa/record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint: endpointKey,
                  endpoint_key: endpointKey,
                  status: statusVal,
                  comment: textareaEl.value,
                }),
              });
            } catch (err) {}
          });

          block.appendChild(panel);
        } else {
          // Update existing panel visibility & values
          panel.style.display = qaMode ? 'block' : 'none';
          panel.className = `qa-endpoint-panel ${itemData.status}`;

          const selectEl = panel.querySelector('.qa-status-select') as HTMLSelectElement;
          if (selectEl && selectEl.value !== itemData.status && document.activeElement !== selectEl) {
            selectEl.value = itemData.status;
          }

          const textareaEl = panel.querySelector('.qa-comment-input') as HTMLTextAreaElement;
          if (textareaEl && textareaEl.value !== (itemData.comment || '') && document.activeElement !== textareaEl) {
            textareaEl.value = itemData.comment || '';
          }
        }
      });
    };

    // Run injection with initial delay & mutation observer
    const timer = setTimeout(injectQAPanels, 200);

    const observer = new MutationObserver(() => {
      injectQAPanels();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [qaMode, qaData, specUrl, onUpdateQAData]);

  return (
    <div className="flex-1 flex flex-col" ref={containerRef}>
      {/* Contextual Sandbox Header Toolbar with Spotlight Search, Scope & QA */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Spotlight Search Trigger (replacing redundant search bar) */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
            <button
              onClick={onOpenSearch}
              type="button"
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 hover:border-slate-400 focus:border-indigo-600 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-between transition-all cursor-pointer shadow-2xs group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span>Search API & Docs...</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500 shadow-2xs">
                  ⌘K
                </kbd>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-500 shadow-2xs">
                  /
                </kbd>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scope / Tag Filter Dropdown */}
            {availableModules.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300/80 rounded-xl px-2.5 py-1.5 text-xs">
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

            {/* QA Mode Toggle */}
            <button
              onClick={onToggleQAMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                qaMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
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
                        // Verify valid JSON
                        JSON.parse(content);
                        const blob = new Blob([content], { type: 'application/json' });
                        const objUrl = URL.createObjectURL(blob);
                        onModuleChange('imported');
                        // Update spec URL to imported blob
                        window.history.replaceState(null, '', '/docs?imported=true');
                        // Reload swagger spec via blob URL
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
          />
        </div>
      </main>
    </div>
  );
};
