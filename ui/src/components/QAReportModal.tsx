import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Copy,
  Download,
  Trash2,
  Search,
  ExternalLink,
  Edit3,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';

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

  if (!isOpen) return null;

  // Calculate sprint stats and system-wide stress/performance aggregates
  const endpointSet = new Set<string>([
    ...(allEndpoints || []),
    ...Object.keys(qaData),
  ]);
  const endpoints = Array.from(endpointSet);
  let passedCount = 0;
  let retestCount = 0;
  let failedCount = 0;
  let untestedCount = 0;

  // Aggregate AI & Stress telemetry
  let totalAiTests = 0;
  let totalAiPassed = 0;
  let endpointsWithAiRuns = 0;
  let peakRps = 0;
  let maxP95 = 0;
  let totalRateLimits = 0;
  let stressTestedCount = 0;
  const slaThresholdMs = 200; // SLA Alert Threshold (200ms)
  let slaViolations = 0;

  for (const ep of endpoints) {
    const item = qaData[ep];
    if (item?.status === 'passed') passedCount++;
    else if (item?.status === 'retest') retestCount++;
    else if (item?.status === 'failed') failedCount++;
    else untestedCount++;

    if (item?.execution_summary && item.execution_summary.total_tests > 0) {
      endpointsWithAiRuns++;
      totalAiTests += item.execution_summary.total_tests;
      totalAiPassed += item.execution_summary.passed;
    }

    if (item?.stress_metrics && item.stress_metrics.total_requests > 0) {
      stressTestedCount++;
      if (item.stress_metrics.rps > peakRps) peakRps = item.stress_metrics.rps;
      if (item.stress_metrics.p95_latency_ms > maxP95) maxP95 = item.stress_metrics.p95_latency_ms;
      if (item.stress_metrics.rate_limited) totalRateLimits += item.stress_metrics.rate_limited;
      if (item.stress_metrics.p95_latency_ms > slaThresholdMs) slaViolations++;
    }
  }

  const total = endpoints.length || 1;
  const testedCount = passedCount + retestCount + failedCount;
  const passRate = testedCount > 0 ? Math.round((passedCount / testedCount) * 100) : 0;
  const aiSuitePassRate = totalAiTests > 0 ? Math.round((totalAiPassed / totalAiTests) * 100) : 0;

  // Filter endpoints
  const filteredEndpoints = endpoints.filter((ep) => {
    const item = qaData[ep] || { status: 'untested', comment: '' };
    const currentStatus = item.status || 'untested';
    const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
    const cleanSearch = searchFilter.trim().toLowerCase();
    const matchesSearch =
      !cleanSearch ||
      ep.toLowerCase().includes(cleanSearch) ||
      (Boolean(item.comment) && item.comment.toLowerCase().includes(cleanSearch));
    return matchesStatus && matchesSearch;
  });

  const generateMarkdown = () => {
    let md = `# ${title || 'REST API'} — QA Sprint & Verification Report\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    md += `### Summary Metrics\n`;
    md += `- **Total Endpoints Tested**: ${testedCount} / ${endpoints.length}\n`;
    md += `- **Manual Pass Rate**: ${passRate}%\n`;
    md += `- **Passed (Working)**: ${passedCount}\n`;
    md += `- **Needs Retest**: ${retestCount}\n`;
    md += `- **Failed / Bugs**: ${failedCount}\n\n`;
    if (endpointsWithAiRuns > 0 || stressTestedCount > 0) {
      md += `### Automated AI & Concurrency Stress Telemetry\n`;
      if (endpointsWithAiRuns > 0) {
        md += `- **AI Test Suite Pass Rate**: ${aiSuitePassRate}% (${totalAiPassed}/${totalAiTests} tests across ${endpointsWithAiRuns} endpoints)\n`;
      }
      if (stressTestedCount > 0) {
        md += `- **Endpoints Stress-Tested**: ${stressTestedCount}\n`;
        md += `- **Peak Throughput**: ${peakRps.toFixed(1)} req/sec\n`;
        md += `- **Worst P95 Latency**: ${maxP95.toFixed(1)} ms\n`;
        md += `- **SLA (>200ms) Violations**: ${slaViolations}\n`;
        md += `- **429 Rate Limits Hit**: ${totalRateLimits}\n\n`;
      }
    }
    md += `| Method & Endpoint | Status | AI Test Suite | Stress Performance | Last Tested | QA Comments / Bug Notes |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const ep of endpoints) {
      const item = qaData[ep] || { status: 'untested', comment: '', tested_at: '' };
      let statusIcon = '⚪ Untested';
      if (item.status === 'passed') statusIcon = '🟢 PASSED';
      if (item.status === 'failed') statusIcon = '🔴 FAILED / BUG';
      if (item.status === 'retest') statusIcon = '🟡 RETEST';

      let aiSummary = '-';
      if (item.execution_summary) {
        aiSummary = `${item.execution_summary.passed}/${item.execution_summary.total_tests} (${item.execution_summary.pass_rate}%) ~${item.execution_summary.avg_latency_ms}ms`;
      }

      let stressSummary = '-';
      if (item.stress_metrics) {
        stressSummary = `${item.stress_metrics.concurrency_level}x conc | ${item.stress_metrics.rps} req/s | P95: ${item.stress_metrics.p95_latency_ms}ms`;
        if (item.stress_metrics.rate_limited > 0) {
          stressSummary += ` | 429: ${item.stress_metrics.rate_limited}`;
        }
      }

      const comment = (item.comment || '-').replace(/\n/g, '<br>');
      md += `| \`${ep}\` | ${statusIcon} | ${aiSummary} | ${stressSummary} | ${item.tested_at || '-'} | ${comment} |\n`;
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

  const handleDownload = () => {
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QA_Sprint_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    // Generate CSV (Excel Compatible with UTF-8 BOM for perfect Excel opening)
    const header = ['Method & Endpoint', 'Status', 'Last Tested', 'QA Bug Notes & Comments'];
    const rows = endpoints.map((ep) => {
      const item = qaData[ep] || { status: 'untested', comment: '', tested_at: '' };
      let statusText = 'Untested';
      if (item.status === 'passed') statusText = 'PASSED';
      if (item.status === 'failed') statusText = 'FAILED / BUG';
      if (item.status === 'retest') statusText = 'RETEST';

      const cleanComment = (item.comment || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
      return `"${ep}","${statusText}","${item.tested_at || '-'}","${cleanComment}"`;
    });

    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QA_Sprint_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Passed
          </span>
        );
      case 'retest':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Retest
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3 h-3 text-slate-500" /> Untested
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-amber-500/20">
              📋
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                QA Sprint & Testing Verification Suite
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Team test checklist, live status tracker, and markdown audit reports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Sprint Summary KPI Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-white border-b border-slate-100">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Tested Progress</div>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              {testedCount} <span className="text-xs text-slate-400 font-normal">/ {endpoints.length}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
            <div className="text-[11px] font-bold text-emerald-700 uppercase">Passed (Verified)</div>
            <div className="text-xl font-black text-emerald-700 mt-1 font-mono">{passedCount}</div>
          </div>

          <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl">
            <div className="text-[11px] font-bold text-amber-700 uppercase">Needs Retest</div>
            <div className="text-xl font-black text-amber-700 mt-1 font-mono">{retestCount}</div>
          </div>

          <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-2xl">
            <div className="text-[11px] font-bold text-rose-700 uppercase">Failed / Bugs</div>
            <div className="text-xl font-black text-rose-700 mt-1 font-mono">{failedCount}</div>
          </div>
        </div>

        {/* Automated System-Wide Concurrency & Stress Health Telemetry Card */}
        {(endpointsWithAiRuns > 0 || stressTestedCount > 0) && (
          <div className="px-6 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                Automated Stress & Suite Health
              </span>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              {endpointsWithAiRuns > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">AI Suite Pass:</span>
                  <span className={`font-mono font-bold ${aiSuitePassRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {aiSuitePassRate}% ({totalAiPassed}/{totalAiTests})
                  </span>
                </div>
              )}
              {stressTestedCount > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Peak Load:</span>
                    <span className="font-mono font-bold text-cyan-300">{peakRps.toFixed(1)} req/s</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Worst P95:</span>
                    <span className={`font-mono font-bold ${maxP95 <= slaThresholdMs ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {maxP95.toFixed(1)}ms
                    </span>
                  </div>
                  {totalRateLimits > 0 && (
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                      <span>429 Throttles:</span>
                      <span className="font-mono">{totalRateLimits}</span>
                    </div>
                  )}
                  {slaViolations > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                      ⚠ SLA &gt;{slaThresholdMs}ms ({slaViolations})
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* View Switcher Tabs & Filter Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Interactive Checklist</span>
            </button>

            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'markdown'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Markdown Audit Report</span>
            </button>
          </div>

          {activeTab === 'table' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter QA checklist..."
                  className="bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
              >
                <option value="all">All ({endpoints.length})</option>
                <option value="passed">🟢 Passed ({passedCount})</option>
                <option value="retest">🟡 Retest ({retestCount})</option>
                <option value="failed">🔴 Failed ({failedCount})</option>
                <option value="untested">⚪ Untested ({untestedCount})</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Body (Table or Markdown) */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeTab === 'table' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <th className="p-3">Endpoint & Route</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Tested</th>
                    <th className="p-3">QA Notes / Bug Details</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredEndpoints.map((ep) => {
                    const item = qaData[ep] || { status: 'untested', comment: '' };
                    return (
                      <tr key={ep} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">{ep}</td>
                        <td className="p-3">{getStatusBadge(item.status)}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {item.tested_at || '—'}
                        </td>
                        <td className="p-3 max-w-sm text-slate-600">
                          <div className="space-y-1.5">
                            <div>{item.comment || <span className="text-slate-400 italic">No notes</span>}</div>

                            {/* Automated AI & Stress Telemetry Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.execution_summary && (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-bold">
                                    <span>⚡ AI Suite:</span>
                                    <span>{item.execution_summary.passed}/{item.execution_summary.total_tests} ({item.execution_summary.pass_rate}%)</span>
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px]">
                                    {item.execution_summary.avg_latency_ms}ms avg
                                  </span>
                                </>
                              )}

                              {item.stress_metrics && (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[10px] font-bold">
                                    <span>🔥 Stress:</span>
                                    <span>{item.stress_metrics.concurrency_level}x conc • {item.stress_metrics.rps} req/s</span>
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[10px] ${item.stress_metrics.p95_latency_ms > slaThresholdMs ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200' : 'bg-slate-100 text-slate-600'}`}>
                                    P95: {item.stress_metrics.p95_latency_ms}ms
                                  </span>
                                  {item.stress_metrics.rate_limited > 0 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-mono text-[10px] font-bold">
                                      429: {item.stress_metrics.rate_limited}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Intelligent Status Escalation / Recommendations */}
                            {(() => {
                              const exec = item.execution_summary;
                              const stress = item.stress_metrics;
                              if (exec && exec.pass_rate === 100 && (!stress || (stress.failed === 0 && stress.p95_latency_ms <= slaThresholdMs)) && item.status !== 'passed') {
                                return (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                                    <span>✨ Recommendation: Ready for Sign-Off (100% Suite Pass)</span>
                                  </div>
                                );
                              }
                              if ((exec && exec.failed > 0) || (stress && stress.failed > 0)) {
                                return (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                    <span>⚠ Recommendation: Failures detected in automated suite</span>
                                  </div>
                                );
                              }
                              if (stress && stress.p95_latency_ms > slaThresholdMs) {
                                return (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                                    <span>⏱ SLA Warning: P95 ({stress.p95_latency_ms}ms) exceeds {slaThresholdMs}ms budget</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {onInspectEndpoint && (
                            <button
                              onClick={() => onInspectEndpoint(ep)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 transition-colors ml-auto cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEndpoints.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                        No endpoints match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {mdContent}
            </pre>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all team QA test records?')) {
                onReset();
              }
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Sprint Data</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>{copied ? '✅ Copied!' : 'Copy Markdown'}</span>
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export to Excel (.csv)</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
