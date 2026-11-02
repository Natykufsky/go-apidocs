import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Copy,
  Check,
  List,
  Search,
  ChevronRight,
  ExternalLink,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import Prism from 'prismjs';

// Import essential Prism language modules
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-http';
import 'prismjs/components/prism-docker';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface MarkdownPreviewProps {
  content: string;
  maskConfidential?: boolean;
  className?: string;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  golang: 'go',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
};

// Slugify header text to anchor ID
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  maskConfidential = false,
  className = '',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showToc, setShowToc] = useState<boolean>(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Mask sensitive values
  const sanitizedRawContent = useMemo(() => {
    if (!content) return '';
    let processed = content;
    if (maskConfidential) {
      processed = processed
        .replace(/DOCS_AUTH_USER=[^\s\n]+/g, 'DOCS_AUTH_USER=••••••••')
        .replace(/DOCS_AUTH_PASS=[^\s\n]+/g, 'DOCS_AUTH_PASS=••••••••')
        .replace(/JWT_SECRET=[^\s\n]+/g, 'JWT_SECRET=••••••••')
        .replace(/Bearer\s+ey[A-Za-z0-9-_=]+/g, 'Bearer ey••••••••')
        .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA••••••••••••••••');
    }
    return processed;
  }, [content, maskConfidential]);

  // Parse HTML and extract TOC headings
  const { html, headings } = useMemo(() => {
    if (!sanitizedRawContent) return { html: '', headings: [] };

    const tocs: TocHeading[] = [];
    const usedSlugs = new Map<string, number>();

    const markedInstance = new Marked();

    markedInstance.use({
      renderer: {
        heading(token: any) {
          const rawText = token.text || '';
          const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
          let slug = slugify(cleanText) || 'heading';

          // Ensure unique heading anchor IDs
          const count = usedSlugs.get(slug) || 0;
          usedSlugs.set(slug, count + 1);
          if (count > 0) slug = `${slug}-${count}`;

          if (token.depth >= 1 && token.depth <= 3 && cleanText) {
            tocs.push({
              id: slug,
              text: cleanText,
              level: token.depth,
            });
          }

          const parsedInline = this.parser.parseInline(token.tokens || []);
          return `<h${token.depth} id="${slug}" class="group relative flex items-center gap-2">
            <span>${parsedInline}</span>
            <a href="#${slug}" class="heading-anchor opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent-500)] text-sm ml-1" title="Link to this section">#</a>
          </h${token.depth}>\n`;
        },

        code(token: any) {
          const rawCode = token.text || '';
          let lang = (token.lang || '').trim().toLowerCase().split(/\s+/)[0];
          lang = LANGUAGE_ALIASES[lang] || lang;

          let highlighted = '';
          if (lang && Prism.languages[lang]) {
            try {
              highlighted = Prism.highlight(rawCode, Prism.languages[lang], lang);
            } catch {
              highlighted = '';
            }
          }

          const displayCode = highlighted || DOMPurify.sanitize(rawCode);
          const blockId = `cb-${Math.random().toString(36).substring(2, 9)}`;

          return `<div class="code-block-wrapper my-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] overflow-hidden shadow-sm" data-code-block="${blockId}">
            <div class="code-block-header flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-mono select-none">
              <div class="flex items-center gap-2 text-[var(--text-tertiary)]">
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-400/40"></span>
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400/40"></span>
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400/40"></span>
                <span class="font-semibold uppercase tracking-wider text-[var(--text-secondary)] ml-1">${lang || 'TEXT'}</span>
              </div>
              <button
                type="button"
                class="copy-code-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] text-[11px] font-sans font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                data-code="${encodeURIComponent(rawCode)}"
              >
                <svg class="w-3.5 h-3.5 icon-copy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                <span class="copy-label">Copy</span>
              </button>
            </div>
            <pre class="!m-0 !p-4 !bg-transparent overflow-x-auto text-[13px] leading-relaxed"><code class="language-${lang || 'none'}">${displayCode}</code></pre>
          </div>\n`;
        },

        blockquote(token: any) {
          const body = this.parser.parse(token.tokens || []);
          // Transform GitHub alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
          const alertMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
          if (alertMatch) {
            const type = alertMatch[1].toUpperCase();
            const cleanBody = body.replace(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>)?/i, '<p>');
            return `<div class="gfm-alert gfm-alert-${type.toLowerCase()} my-4 p-4 rounded-xl border flex gap-3.5">
              <div class="alert-icon flex-shrink-0 mt-0.5"></div>
              <div class="alert-content flex-1 text-sm leading-relaxed">${cleanBody}</div>
            </div>\n`;
          }
          return `<blockquote class="my-4 pl-4 border-l-4 border-[var(--border-default)] text-[var(--text-secondary)] italic">${body}</blockquote>\n`;
        },

        table(token: any) {
          let header = '';
          for (let i = 0; i < token.header.length; i++) {
            header += `<th>${this.parser.parseInline(token.header[i].tokens || [])}</th>`;
          }
          let rows = '';
          for (let i = 0; i < token.rows.length; i++) {
            let row = '';
            for (let j = 0; j < token.rows[i].length; j++) {
              row += `<td>${this.parser.parseInline(token.rows[i][j].tokens || [])}</td>`;
            }
            rows += `<tr>${row}</tr>`;
          }
          return `<div class="markdown-table-wrapper my-5 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <table class="w-full text-left text-sm border-collapse">
              <thead><tr class="bg-[var(--bg-overlay)] border-b border-[var(--border-subtle)]">${header}</tr></thead>
              <tbody class="divide-y divide-[var(--border-subtle)]">${rows}</tbody>
            </table>
          </div>\n`;
        },
      },
    });

    const parsed = markedInstance.parse(sanitizedRawContent) as string;

    const sanitizedHtml = DOMPurify.sanitize(parsed, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
        'blockquote', 'code', 'pre', 'em', 'strong', 'del', 'hr', 'br',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
        'button', 'svg', 'path',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'id',
        'data-code', 'data-code-block', 'fill', 'stroke', 'viewBox',
        'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd',
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
    });

    return { html: sanitizedHtml, headings: tocs };
  }, [sanitizedRawContent]);

  // Bind delegated copy button clicks inside rendered HTML
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onCopyClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('.copy-code-btn') as HTMLButtonElement | null;
      if (!btn) return;
      const raw = btn.getAttribute('data-code');
      if (!raw) return;

      const decoded = decodeURIComponent(raw);
      navigator.clipboard.writeText(decoded).then(() => {
        const label = btn.querySelector('.copy-label');
        if (label) label.textContent = 'Copied!';
        btn.classList.add('text-emerald-500');
        setTimeout(() => {
          if (label) label.textContent = 'Copy';
          btn.classList.remove('text-emerald-500');
        }, 2000);
      });
    };

    root.addEventListener('click', onCopyClick);
    return () => root.removeEventListener('click', onCopyClick);
  }, [html]);

  // Observer to track which heading is currently active as user scrolls
  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-60px 0px -75% 0px', threshold: 0 },
    );

    const elements = headings.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, html]);

  // Filter TOC based on search query
  const filteredHeadings = useMemo(() => {
    if (!searchQuery.trim()) return headings;
    const q = searchQuery.toLowerCase();
    return headings.filter((h) => h.text.toLowerCase().includes(q));
  }, [headings, searchQuery]);

  return (
    <div className={`relative flex flex-col lg:flex-row gap-8 items-start ${className}`}>
      {/* Main Markdown Content Area */}
      <div className="flex-1 min-w-0 w-full">
        {/* Document Quick Action Toolbar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--accent-500)]" />
            <span className="font-medium text-[var(--text-secondary)]">Formatted Document Preview</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-overlay)] border border-[var(--border-subtle)] font-mono">
              GFM + Prism
            </span>
          </div>

          <div className="flex items-center gap-3">
            {headings.length > 0 && (
              <button
                type="button"
                onClick={() => setShowToc((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors text-[11px]"
              >
                <List className="w-3.5 h-3.5" />
                {showToc ? 'Hide Outline' : 'Show Outline'}
              </button>
            )}
          </div>
        </div>

        {/* Rendered HTML */}
        <div
          ref={containerRef}
          className="markdown-body max-w-none text-[var(--text-primary)] leading-relaxed select-text"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Floating Sticky Table of Contents (Outline) */}
      {showToc && headings.length > 2 && (
        <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <List className="w-3.5 h-3.5 text-[var(--accent-500)]" />
              On this page
            </div>
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono">{headings.length}</span>
          </div>

          {/* Quick Filter */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter sections..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-500)] transition-colors"
            />
          </div>

          {/* Nav List */}
          <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[12.5px]">
            {filteredHeadings.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--text-tertiary)]">No matching sections</div>
            ) : (
              filteredHeadings.map((h) => {
                const active = activeHeadingId === h.id;
                const indent = h.level === 1 ? '' : h.level === 2 ? 'pl-3' : 'pl-6';
                return (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const target = document.getElementById(h.id);
                      if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        window.history.pushState(null, '', `#${h.id}`);
                        setActiveHeadingId(h.id);
                      }
                    }}
                    className={`block py-1 rounded-md transition-colors leading-snug truncate ${indent} ${
                      active
                        ? 'text-[var(--accent-500)] font-semibold bg-[var(--bg-overlay)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                    title={h.text}
                  >
                    {h.text}
                  </a>
                );
              })
            )}
          </nav>
        </aside>
      )}
    </div>
  );
};
