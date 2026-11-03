import { useEffect, RefObject } from 'react';
import type { QARecord } from '../components/QAReportModal';
import type { RendererChoice } from './rendererPreference';

interface Config {
  containerRef: RefObject<HTMLElement>;
  renderer: RendererChoice;
  qaData: Record<string, QARecord>;
  qaMode: boolean;
  onInspectEndpoint?: (key: string) => void;
  specUrl: string;
}

const SELECTORS: Record<
  RendererChoice,
  {
    opblock: string;
    summary: string;
    method: string;
    path: string;
    insertBefore: string | null;
    insertAfter: string | null;
  }
> = {
  swagger: {
    opblock: '.opblock',
    summary: '.opblock-summary',
    method: '.opblock-summary-method',
    path: '.opblock-summary-path',
    insertBefore: '.opblock-summary-control',
    insertAfter: null,
  },
  scalar: {
    opblock: '.endpoint',
    summary: '.endpoint',
    method: '.endpoint-method',
    path: '.endpoint-path',
    insertBefore: null,
    insertAfter: '.endpoint-header',
  }
};

const renderPillHtml = (status?: QARecord['status'], comment?: string) => {
  let cls = 'pill';
  let dot = 'var(--text-tertiary)';
  let label = 'Untested';
  if (status === 'passed') {
    cls = 'pill pill--success';
    dot = 'var(--success-500)';
    label = 'Passed';
  } else if (status === 'retest') {
    cls = 'pill pill--warning';
    dot = 'var(--warning-500)';
    label = 'Retest';
  } else if (status === 'failed') {
    cls = 'pill pill--danger';
    dot = 'var(--danger-500)';
    label = 'Failed';
  }
  const commentHtml = comment
    ? `<span style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-tertiary);margin-left:8px">${comment
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</span>`
    : '';
  return `
    <div class="qa-pill-inner" style="display:flex;align-items:center;margin-right:12px;cursor:pointer">
      <span class="${cls}" style="display:inline-flex;align-items:center;gap:5px">
        <span style="width:6px;height:6px;border-radius:50%;background:${dot};display:inline-block"></span>
        ${label}
      </span>
      ${commentHtml}
    </div>
  `;
};

export const useQAPillInjection = ({
  containerRef,
  renderer,
  qaData,
  qaMode,
  onInspectEndpoint,
  specUrl,
}: Config) => {
  useEffect(() => {
    // QA pills only make sense in Swagger's accordion layout.
    // Scalar shows a summary badge instead (see SwaggerSandboxView).
    if (renderer === 'scalar') return;

    const config = SELECTORS[renderer];
    let isInjecting = false;

    let retryCount = 0;
    const maxRetries = 20;

    const inject = () => {
      if (isInjecting) return;
      const root = containerRef.current;
      if (!root) return;
      isInjecting = true;
      try {
        const ops = root.querySelectorAll(config.opblock);
        if (ops.length === 0) {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(inject, 250);
            return;
          }
          const warnedKey = `__qaWarned_${renderer}`;
          if (!(window as any)[warnedKey]) {
            // eslint-disable-next-line no-console
            console.warn(
              `[QA pills] No operations found for "${renderer}" using selector "${config.opblock}". ` +
                `Inspect the DOM and update SELECTORS in useQAPillInjection.ts. ` +
                `The global QABar still shows coverage.`,
            );
            (window as any)[warnedKey] = true;
          }
          return;
        }

        // Successfully found operation blocks - reset retry counter and warning flag
        retryCount = 0;
        delete (window as any)[`__qaWarned_${renderer}`];

        ops.forEach((op) => {
          const methodEl = op.querySelector(config.method);
          const pathEl = op.querySelector(config.path);
          if (!methodEl || !pathEl) return;
          const method = methodEl.textContent?.trim().toUpperCase() || '';
          const path = pathEl.getAttribute('data-path') || pathEl.textContent?.trim() || '';
          if (!method || !path) return;
          const key = `${method} ${path}`;
          const rec = qaData[key];

          const container = (config.summary ? op.querySelector(config.summary) : op) || op;
          const existingPills = container.querySelectorAll('.qa-pill-trigger');
          if (existingPills.length > 1) {
            for (let i = 1; i < existingPills.length; i++) {
              existingPills[i].remove();
            }
          }

          let pill = (existingPills[0] as HTMLDivElement) || null;
          if (!pill) {
            pill = document.createElement('div');
            pill.className = 'qa-pill-trigger';
            pill.style.display = qaMode ? 'flex' : 'none';
            pill.innerHTML = renderPillHtml(rec?.status, rec?.comment);
            pill.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onInspectEndpoint?.(key);
            };

            if (config.insertBefore) {
              const t = container.querySelector(config.insertBefore);
              if (t?.parentElement) {
                t.parentElement.insertBefore(pill, t);
              } else {
                container.appendChild(pill);
              }
            } else if (config.insertAfter) {
              const t = container.querySelector(config.insertAfter);
              if (t?.parentElement) {
                t.parentElement.insertBefore(pill, t.nextSibling);
              } else {
                container.appendChild(pill);
              }
            } else {
              container.appendChild(pill);
            }
          } else {
            pill.style.display = qaMode ? 'flex' : 'none';
            pill.innerHTML = renderPillHtml(rec?.status, rec?.comment);
            pill.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              onInspectEndpoint?.(key);
            };
          }
        });
      } finally {
        setTimeout(() => {
          isInjecting = false;
        }, 100);
      }
    };

    let debounceTimer: number | undefined;
    const debounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(inject, 150);
    };

    const initial = window.setTimeout(inject, 350);
    const observer = new MutationObserver((mutations) => {
      const internal = mutations.every(
        (m) =>
          (m.target as HTMLElement)?.classList?.contains('qa-pill-trigger') ||
          (m.target as HTMLElement)?.closest?.('.qa-pill-trigger'),
      );
      if (!internal) debounced();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }
    return () => {
      clearTimeout(initial);
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [renderer, qaMode, qaData, specUrl, onInspectEndpoint, containerRef]);
};