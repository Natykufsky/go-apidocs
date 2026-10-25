import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Copy,
  Download,
  Trash2,
  Search,
  Edit3,
  FileSpreadsheet,
  FileCode,
  FileJson,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { Modal } from './Modal';

export interface QARecord {
  status: 'passed' | 'retest' | 'failed' | 'untested';
  comment?: string;
  tested_at?: string;
  tester?: string;
  execution_summary?: {
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_latency_ms: number;
    run_at: string;
  };
  stress_metrics?: {
    concurrency_level: number;
    total_requests: number;
    successful: number;
    failed: number;
    rate_limited: number;
    rps: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    duration_ms: number;
    run_at: string;
  };
  ai_suite?: {
    summary?: string;
    model_used?: string;
    test_cases?: any[];
  };
}

interface QAReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qaData: Record<string, QARecord>;
  onReset: () => void;
  onInspectEndpoint?: (endpoint: string) => void;
  allEndpoints?: string[];
}

type SortField = 'endpoint' | 'status' | 'tested_at';
type SortDir = 'asc' | 'desc';

const statusTone = (s: string): { fg: string; bg: string; bd: string; label: string; Icon: React.ComponentType<{ className?: string }> } => {
  switch (s) {
    case 'passed':
      return { fg: 'var(--success-500)', bg: 'color-mix(in srgb, var(--success-500) 10%, transparent)', bd: 'color-mix(in srgb, var(--success-500) 26%, transparent)', label: 'Passed', Icon: CheckCircle2 };
    case 'retest':
      return { fg: 'var(--warning-500)', bg: 'color-mix(in srgb, var(--warning-500) 10%, transparent)', bd: 'color-mix(in srgb, var(--warning-500) 26%, transparent)', label: 'Retest', Icon: AlertTriangle };
    case 'failed':
      return { fg: 'var(--danger-500)', bg: 'color-mix(in srgb, var(--danger-500) 10%, transparent)', bd: 'color-mix(in srgb, var(--danger-500) 26%, transparent)', label: 'Failed', Icon: XCircle };
    default:
      return { fg: 'var(--text-tertiary)', bg: 'var(--bg-overlay)', bd: 'var(--border-subtle)', label: 'Untested', Icon: HelpCircle };
  }
};

const SLA_THRESHOLD_MS = 200;

export const QAReportModal: React.FC<QAReportModalProps> = ({
  isOpen,
  onClose,
  title,
  qaData,
  onReset,
  onInspectEndpoint,
  allEndpoints = [],
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'markdown'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedRowKey, setCopiedRowKey] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* ---------- aggregate ---------- */
  const { endpoints, stats, agg } = useMemo(() => {
    const set = new Set<string>([...(allEndpoints || []), ...Object.keys(qaData)]);
    const list = Array.from(set);

    let passed = 0, retest = 0, failed = 0, untested = 0;
    let totalAiTests = 0, totalAiPassed = 0, endpointsWithAi = 0;
    let peakRps = 0, maxP95 = 0, totalRateLimits = 0, stressTested = 0, slaViolations = 0;

    for (const ep of list) {
      const it = qaData[ep];
      if (it?.status === 'passed') passed++;
      else if (it?.status === 'retest') retest++;
      else if (it?.status === 'failed') failed++;
      else untested++;

      if (it?.execution_summary && it.execution_summary.total_tests > 0) {
        endpointsWithAi++;
        totalAiTests += it.execution_summary.total_tests;
        totalAiPassed += it.execution_summary.passed;
      }

      if (it?.stress_metrics && it.stress_metrics.total_requests > 0) {
        stressTested++;
        if (it.stress_metrics.rps > peakRps) peakRps = it.stress_metrics.rps;
        if (it.stress_metrics.p95_latency_ms > maxP95) maxP95 = it.stress_metrics.p95_latency_ms;
        if (it.stress_metrics.rate_limited) totalRateLimits += it.stress_metrics.rate_limited;
        if (it.stress_metrics.p95_latency_ms > SLA_THRESHOLD_MS) slaViolations++;
      }
    }

    return {
      endpoints: list,
      stats: { passed, retest, failed, untested },
      agg: {
        totalAiTests, totalAiPassed, endpointsWithAi,
        peakRps, maxP95, totalRateLimits, stressTested, slaViolations,
      },
    };
  }, [allEndpoints, qaData]);

  const testedCount = stats.passed + stats.retest + stats.failed;
  const passRate = testedCount > 0 ? Math.round((stats.passed / testedCount) * 100) : 0;
  const aiSuitePassRate = agg.totalAiTests > 0 ? Math.round((agg.totalAiPassed / agg.totalAiTests) * 100) : 0;

  /* ---------- filter + sort ---------- */
  const filteredEndpoints = useMemo(() => {
    const cleanSearch = searchFilter.trim().toLowerCase();
    const statusRank: Record<string, number> = { failed: 0, retest: 1, passed: 2, untested: 3 };

    const rows = endpoints.filter((ep) => {
      const item = qaData[ep] || { status: 'untested' as const, comment: '' };
      const currentStatus = item.status || 'untested';
      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      const matchesSearch = !cleanSearch
        || ep.toLowerCase().includes(cleanSearch)
        || (!!item.comment && item.comment.toLowerCase().includes(cleanSearch));
      return matchesStatus && matchesSearch;
    });

    rows.sort((a, b) => {
      const ia = qaData[a] || { status: 'untested' as const, tested_at: '' };
      const ib = qaData[b] || { status: 'untested' as const, tested_at: '' };
      let cmp = 0;
      if (sortField === 'endpoint') {
        cmp = a.localeCompare(b);
      } else if (sortField === 'status') {
        cmp = (statusRank[ia.status] ?? 9) - (statusRank[ib.status] ?? 9);
      } else if (sortField === 'tested_at') {
        cmp = (ia.tested_at || '').localeCompare(ib.tested_at || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [endpoints, qaData, searchFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'endpoint' ? 'asc' : 'desc');
    }
  };

  /* ---------- exports ---------- */
  const generateMarkdown = (): string => {
    let md = `# ${title || 'REST API'} — QA Sprint Report\n\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    md += `## Summary\n\n`;
    md += `- **Tested**: ${testedCount} / ${endpoints.length}\n`;
    md += `- **Pass rate**: ${passRate}%\n`;
    md += `- **Passed**: ${stats.passed}\n`;
    md += `- **Retest**: ${stats.retest}\n`;
    md += `- **Failed**: ${stats.failed}\n\n`;

    if (agg.endpointsWithAi > 0 || agg.stressTested > 0) {
      md += `## Automated telemetry\n\n`;
      if (agg.endpointsWithAi > 0) {
        md += `- **AI suite pass rate**: ${aiSuitePassRate}% (${agg.totalAiPassed}/${agg.totalAiTests} across ${agg.endpointsWithAi} endpoints)\n`;
      }
      if (agg.stressTested > 0) {
        md += `- **Endpoints stress-tested**: ${agg.stressTested}\n`;
        md += `- **Peak throughput**: ${agg.peakRps.toFixed(1)} req/s\n`;
        md += `- **Worst P95**: ${agg.maxP95.toFixed(1)} ms\n`;
        md += `- **SLA violations (>${SLA_THRESHOLD_MS}ms)**: ${agg.slaViolations}\n`;
        md += `- **429 rate limits**: ${agg.totalRateLimits}\n\n`;
      }
    }

    md += `| Endpoint | Status | AI suite | Stress | Last tested | Notes |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;

    for (const ep of endpoints) {
      const item = qaData[ep] || { status: 'untested', comment: '', tested_at: '' };
      let statusText = 'Untested';
      if (item.status === 'passed') statusText = 'PASSED';
      if (item.status === 'failed') statusText = 'FAILED';
      if (item.status === 'retest') statusText = 'RETEST';

      let aiSummary = '-';
      if (item.execution_summary) {
        aiSummary = `${item.execution_summary.passed}/${item.execution_summary.total_tests} (${item.execution_summary.pass_rate}%) ~${item.execution_summary.avg_latency_ms}ms`;
      }

      let stressSummary = '-';
      if (item.stress_metrics) {
        stressSummary = `${item.stress_metrics.concurrency_level}x · ${item.stress_metrics.rps} rps · P95 ${item.stress_metrics.p95_latency_ms}ms`;
      }

      const comment = (item.comment || '-').replace(/\n/g, ' ');
      md += `| \`${ep}\` | ${statusText} | ${aiSummary} | ${stressSummary} | ${item.tested_at || '-'} | ${comment} |\n`;
    }
    return md;
  };

  const mdContent = generateMarkdown();

  const handleCopy = () => {
    navigator.clipboard.writeText(mdContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (format: 'md' | 'csv' | 'json') => {
    if (format === 'json') {
      const payload = {
        title,
        generated_at: new Date().toISOString(),
        summary: { total: endpoints.length, ...stats, pass_rate: passRate },
        telemetry: agg,
        endpoints: endpoints.map((ep) => ({ endpoint: ep, ...(qaData[ep] || { status: 'untested' }) })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QA_Sprint_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (format === 'csv') {
      const header = ['Endpoint', 'Status', 'Last tested', 'Notes'];
      const escape = (s?: string) => `"${(s || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      const rows = endpoints.map((ep) => {
        const item = qaData[ep] || { status: 'untested', comment: '', tested_at: '' };
        const statusText =
          item.status === 'passed' ? 'PASSED'
          : item.status === 'failed' ? 'FAILED'
          : item.status === 'retest' ? 'RETEST'
          : 'Untested';
        return [ep, statusText, item.tested_at || '-', item.comment].map(escape).join(',');
      });
      const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QA_Sprint_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QA_Sprint_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- copy row as markdown ---------- */
  const copyRowMarkdown = (ep: string) => {
    const item = qaData[ep] || { status: 'untested', comment: '', tested_at: '' };
    const lines = [
      `### \`${ep}\``,
      '',
      `- **Status:** ${statusTone(item.status).label}`,
      `- **Last tested:** ${item.tested_at || '—'}`,
    ];
    if (item.execution_summary) {
      const s = item.execution_summary;
      lines.push(`- **AI suite:** ${s.passed}/${s.total_tests} passed (${s.pass_rate}%) · avg ${s.avg_latency_ms}ms`);
    }
    if (item.stress_metrics) {
      const s = item.stress_metrics;
      lines.push(`- **Stress:** ${s.concurrency_level}x · ${s.rps} rps · P95 ${s.p95_latency_ms}ms${s.rate_limited ? ` · 429: ${s.rate_limited}` : ''}`);
    }
    if (item.comment) lines.push('', `> ${item.comment}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedRowKey(ep);
    setTimeout(() => setCopiedRowKey(null), 1800);
  };

  /* ---------- SortHeader component ---------- */
  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode; align?: 'left' | 'right' }> = ({ field, children, align = 'left' }) => {
    const active = sortField === field;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors ${align === 'right' ? 'ml-auto' : ''}`}
        style={{ color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', letterSpacing: '0.04em' }}
      >
        {children}
        <Icon className="w-3 h-3" />
      </button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="QA sprint report"
      subtitle={`${title} · ${testedCount}/${endpoints.length} tested · ${passRate}% pass rate`}
      widthClass="max-w-5xl"
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { label: 'Tested', value: testedCount, total: endpoints.length, tone: 'default' },
          { label: 'Passed', value: stats.passed, tone: 'success' },
          { label: 'Retest', value: stats.retest, tone: 'warning' },
          { label: 'Failed', value: stats.failed, tone: 'danger' },
        ].map((k) => {
          const colors: Record<string, string> = {
            default: 'var(--text-primary)',
            success: 'var(--success-500)',
            warning: 'var(--warning-500)',
            danger: 'var(--danger-500)',
          };
          return (
            <div
              key={k.label}
              className="p-2.5 rounded-[var(--r-sm)]"
              style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="text-[10px] font-semibold uppercase mb-1"
                style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
              >
                {k.label}
              </div>
              <div className="mono text-[17px] font-semibold leading-none" style={{ color: colors[k.tone], letterSpacing: '-0.02em' }}>
                {k.value}
                {k.total != null && (
                  <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>
                    / {k.total}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemetry bar */}
      {(agg.endpointsWithAi > 0 || agg.stressTested > 0) && (
        <div
          className="px-5 py-2.5 flex flex-wrap items-center gap-4 text-[11.5px] mono"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}
        >
          {agg.endpointsWithAi > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: 'var(--text-tertiary)' }}>AI suite pass</span>
              <span style={{ color: aiSuitePassRate >= 90 ? 'var(--success-500)' : 'var(--warning-500)', fontWeight: 600 }}>
                {aiSuitePassRate}% ({agg.totalAiPassed}/{agg.totalAiTests})
              </span>
            </span>
          )}
          {agg.stressTested > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: 'var(--text-tertiary)' }}>Peak load</span>
                <span style={{ color: 'var(--accent-500)', fontWeight: 600 }}>{agg.peakRps.toFixed(1)} rps</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span style={{ color: 'var(--text-tertiary)' }}>Worst P95</span>
                <span style={{ color: agg.maxP95 <= SLA_THRESHOLD_MS ? 'var(--success-500)' : 'var(--danger-500)', fontWeight: 600 }}>
                  {agg.maxP95.toFixed(1)}ms
                </span>
              </span>
              {agg.totalRateLimits > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-tertiary)' }}>429s</span>
                  <span style={{ color: 'var(--danger-500)', fontWeight: 600 }}>{agg.totalRateLimits}</span>
                </span>
              )}
              {agg.slaViolations > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{
                    background: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
                    color: 'var(--danger-500)',
                    border: '1px solid color-mix(in srgb, var(--danger-500) 24%, transparent)',
                    fontWeight: 600,
                  }}
                >
                  SLA &gt;{SLA_THRESHOLD_MS}ms ({agg.slaViolations})
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Tabs + filters */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-2 flex-wrap"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-1">
          {([
            { id: 'table' as const, label: 'Checklist', Icon: FileSpreadsheet },
            { id: 'markdown' as const, label: 'Markdown', Icon: FileCode },
          ]).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="pb-2 pt-1 px-2 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: active ? '2px solid var(--accent-500)' : '2px solid transparent',
                  marginBottom: -9,
                }}
              >
                <t.Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'table' && (
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 h-7 px-2 rounded-[var(--r-sm)]"
              style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
            >
              <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter…"
                className="bg-transparent outline-none text-[11.5px] w-32"
                style={{ color: 'var(--text-primary)' }}
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="shrink-0"
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 px-2 rounded-[var(--r-sm)] text-[11.5px] font-medium outline-none cursor-pointer"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All statuses ({endpoints.length})</option>
              <option value="passed">Passed ({stats.passed})</option>
              <option value="retest">Retest ({stats.retest})</option>
              <option value="failed">Failed ({stats.failed})</option>
              <option value="untested">Untested ({stats.untested})</option>
            </select>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'table' ? (
          <>
            {/* Status bar showing counts */}
            <div
              className="px-5 py-1.5 text-[11px] flex items-center justify-between"
              style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
            >
              <span>
                Showing <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{filteredEndpoints.length}</span> of {endpoints.length} endpoints
              </span>
              <span className="mono">{sortField} · {sortDir}</span>
            </div>

            {filteredEndpoints.length === 0 ? (
              <div className="py-20 text-center">
                <div
                  className="w-10 h-10 rounded-full grid place-items-center mx-auto mb-3"
                  style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}
                >
                  <Search className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div className="text-[12.5px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  {endpoints.length === 0 ? 'No endpoints in this workspace' : 'No endpoints match your filters'}
                </div>
                <div className="text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                  {endpoints.length === 0
                    ? 'Import a spec to get started.'
                    : 'Try clearing the search or choosing a different status.'}
                </div>
              </div>
            ) : (
              <table className="w-full text-[12.5px] border-collapse">
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      <SortHeader field="endpoint">Endpoint</SortHeader>
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium w-[110px]" style={{ color: 'var(--text-tertiary)' }}>
                      <SortHeader field="status">Status</SortHeader>
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium w-[110px] hidden md:table-cell" style={{ color: 'var(--text-tertiary)' }}>
                      <SortHeader field="tested_at">Tested</SortHeader>
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell" style={{ color: 'var(--text-tertiary)' }}>
                      Notes
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium w-[100px]" style={{ color: 'var(--text-tertiary)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEndpoints.map((ep) => {
                    const item = qaData[ep] || { status: 'untested' as const, comment: '', tested_at: '' };
                    const tone = statusTone(item.status);
                    const isCopied = copiedRowKey === ep;
                    return (
                      <tr
                        key={ep}
                        className="group transition-colors"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="px-4 py-2.5 min-w-0">
                          <div className="mono text-[11.5px] truncate" style={{ color: 'var(--text-primary)' }} title={ep}>
                            {ep}
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {item.execution_summary && (
                              <span
                                className="mono text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'color-mix(in srgb, var(--info-500) 10%, transparent)',
                                  color: 'var(--info-500)',
                                  border: '1px solid color-mix(in srgb, var(--info-500) 22%, transparent)',
                                }}
                              >
                                AI {item.execution_summary.passed}/{item.execution_summary.total_tests} · {item.execution_summary.pass_rate}%
                              </span>
                            )}
                            {item.stress_metrics && (
                              <span
                                className="mono text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: item.stress_metrics.p95_latency_ms > SLA_THRESHOLD_MS
                                    ? 'color-mix(in srgb, var(--danger-500) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--warning-500) 10%, transparent)',
                                  color: item.stress_metrics.p95_latency_ms > SLA_THRESHOLD_MS ? 'var(--danger-500)' : 'var(--warning-500)',
                                  border: `1px solid color-mix(in srgb, ${item.stress_metrics.p95_latency_ms > SLA_THRESHOLD_MS ? 'var(--danger-500)' : 'var(--warning-500)'} 22%, transparent)`,
                                }}
                              >
                                {item.stress_metrics.concurrency_level}x · P95 {item.stress_metrics.p95_latency_ms}ms
                                {item.stress_metrics.rate_limited > 0 ? ` · 429: ${item.stress_metrics.rate_limited}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-pill)] text-[10.5px] font-medium"
                            style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}
                          >
                            <tone.Icon className="w-3 h-3" />
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {item.tested_at || '—'}
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell max-w-[280px]">
                          <div className="text-[11.5px] line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {item.comment || <span style={{ color: 'var(--text-tertiary)' }}>No notes</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => copyRowMarkdown(ep)}
                              className="grid place-items-center w-6 h-6 rounded transition-colors opacity-0 group-hover:opacity-100"
                              style={{ color: 'var(--text-tertiary)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                              title="Copy as GitHub/Jira markdown"
                            >
                              {isCopied ? (
                                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success-500)' }} />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onInspectEndpoint && (
                              <button
                                type="button"
                                onClick={() => onInspectEndpoint(ep)}
                                className="inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors"
                                style={{ color: 'var(--accent-500)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-muted)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Edit3 className="w-3 h-3" />
                                Inspect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="p-5">
            <pre
              className="p-4 rounded-[var(--r-md)] mono text-[11.5px] leading-relaxed overflow-x-auto whitespace-pre-wrap"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              {mdContent}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-2 px-5 py-3"
        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}
      >
        <button
          onClick={() => {
            if (window.confirm('Reset all team QA test records? This cannot be undone.')) {
              onReset();
            }
          }}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--danger-500) 30%, transparent)',
            color: 'var(--danger-500)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-500) 8%, transparent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Reset data
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied' : 'Copy MD'}
          </button>

          <div className="flex items-center rounded-[var(--r-sm)] overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => handleDownload('csv')}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-[12px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', borderRight: '1px solid var(--border-default)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              title="Export as CSV (Excel-compatible)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={() => handleDownload('json')}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-[12px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              title="Export as structured JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>

          <button
            onClick={() => handleDownload('md')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-semibold transition-all"
            style={{
              background: 'var(--accent-500)',
              color: 'var(--text-inverse)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.4)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-400)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-500)'; }}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>
    </Modal>
  );
};