import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Download,
  Flame,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from './Modal';

interface SecurityFinding {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS';
  title: string;
  description: string;
  path?: string;
  method?: string;
  remediation: string;
  owasp_ref?: string;
}

interface HeaderAuditResult {
  target_url: string;
  status: number;
  headers: Record<string, string>;
  checks: SecurityFinding[];
}

interface FuzzPayload {
  name: string;
  payload: string;
  description: string;
  risk: string;
}

interface FuzzingPresetGroup {
  category: string;
  payloads: FuzzPayload[];
}

interface SecurityAuditResult {
  timestamp: string;
  score: number;
  grade: string;
  total_issues: number;
  critical_count: number;
  warning_count: number;
  pass_count: number;
  static_findings: SecurityFinding[];
  header_audit?: HeaderAuditResult;
  fuzzing_presets: FuzzingPresetGroup[];
  owasp_matrix?: Record<string, number>;
}

interface SecurityAuditModalProps {
  activeWorkspaceId: string;
  activeServiceId: string;
  targetEnvUrl?: string;
  onClose: () => void;
  onSelectFuzzPayload?: (payload: string) => void;
}

/* ---------- token helpers ---------- */
const severityTone = (s: string): { fg: string; bg: string; bd: string } => {
  const map: Record<string, { fg: string; bg: string; bd: string }> = {
    CRITICAL: {
      fg: 'var(--danger-500)',
      bg: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--danger-500) 30%, transparent)',
    },
    WARNING: {
      fg: 'var(--warning-500)',
      bg: 'color-mix(in srgb, var(--warning-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--warning-500) 30%, transparent)',
    },
    INFO: {
      fg: 'var(--info-500)',
      bg: 'color-mix(in srgb, var(--info-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--info-500) 30%, transparent)',
    },
    PASS: {
      fg: 'var(--success-500)',
      bg: 'color-mix(in srgb, var(--success-500) 10%, transparent)',
      bd: 'color-mix(in srgb, var(--success-500) 30%, transparent)',
    },
  };
  return map[s] || map.INFO;
};

const gradeColor = (g: string): string => {
  if (g.startsWith('A')) return 'var(--grade-a)';
  if (g.startsWith('B')) return 'var(--grade-b)';
  if (g.startsWith('C')) return 'var(--grade-c)';
  if (g.startsWith('D')) return 'var(--grade-d)';
  return 'var(--grade-f)';
};

const gradeToNum = (g: string): number => {
  const letter = g.charAt(0).toUpperCase();
  const mod = g.charAt(1);
  const base: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const delta = mod === '+' ? 0.3 : mod === '-' ? -0.3 : 0;
  return (base[letter] ?? 0) + delta;
};

const PREV_GRADE_KEY = 'apidocs_security_prev_grade';

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  activeWorkspaceId,
  activeServiceId,
  targetEnvUrl,
  onClose,
  onSelectFuzzPayload,
}) => {
  const [auditData, setAuditData] = useState<SecurityAuditResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'headers' | 'fuzzing'>('findings');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS'>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [prevGrade, setPrevGrade] = useState<string | null>(null);
  const scrollTopRef = useRef<HTMLDivElement>(null);

  const fetchAudit = () => {
    setLoading(true);
    setError(null);

    let url = `/docs/security/audit?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    if (targetEnvUrl) url += `&target_url=${encodeURIComponent(targetEnvUrl)}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Audit request returned status ${res.status}`);
        return res.json();
      })
      .then((data: SecurityAuditResult) => {
        // Persist previous grade for delta display
        try {
          const stored = localStorage.getItem(PREV_GRADE_KEY);
          if (stored && stored !== data.grade) setPrevGrade(stored);
          localStorage.setItem(PREV_GRADE_KEY, data.grade);
        } catch {}
        setAuditData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to run security audit');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, activeServiceId, targetEnvUrl]);

  // ⌘R re-run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (!loading) fetchAudit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /* ---------- finding → markdown for GitHub/Jira issue ---------- */
  const findingToIssueMarkdown = (f: SecurityFinding): string => {
    const lines = [
      `## [${f.severity}] ${f.title}`,
      '',
      `**Category:** ${f.category}${f.owasp_ref ? ` (${f.owasp_ref})` : ''}`,
    ];
    if (f.method && f.path) lines.push(`**Operation:** \`${f.method} ${f.path}\``);
    lines.push('', '**Description**', '', f.description, '', '**Remediation**', '', f.remediation);
    return lines.join('\n');
  };

  /* ---------- CSV export ---------- */
  const handleExportCSV = () => {
    if (!auditData) return;
    const header = ['Severity', 'Category', 'OWASP', 'Method', 'Path', 'Title', 'Description', 'Remediation'];
    const escape = (s?: string) => `"${(s || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const rows = auditData.static_findings.map((f) =>
      [f.severity, f.category, f.owasp_ref || '', f.method || '', f.path || '', f.title, f.description, f.remediation]
        .map(escape)
        .join(','),
    );
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-audit-${activeServiceId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Markdown export ---------- */
  const handleExportMarkdown = () => {
    if (!auditData) return;
    let md = `# API Cybersecurity & Compliance Audit\n\n`;
    md += `**Service:** ${activeServiceId} · **Workspace:** ${activeWorkspaceId}\n\n`;
    md += `**Timestamp:** ${new Date(auditData.timestamp).toUTCString()}\n\n`;
    md += `**Score:** ${auditData.score}/100 · **Grade:** ${auditData.grade}\n\n`;
    md += `**Findings:** ${auditData.critical_count} critical · ${auditData.warning_count} warnings · ${auditData.pass_count} passed\n\n`;

    if (auditData.owasp_matrix && Object.keys(auditData.owasp_matrix).length > 0) {
      md += `## OWASP API Top 10 breakdown\n\n`;
      Object.entries(auditData.owasp_matrix).forEach(([k, v]) => {
        md += `- **${k}**: ${v} potential exposure(s)\n`;
      });
      md += '\n';
    }

    md += `## Static findings\n\n`;
    auditData.static_findings.forEach((f) => {
      md += `### [${f.severity}] ${f.title}\n\n`;
      md += `- **Category:** ${f.category}${f.owasp_ref ? ` (${f.owasp_ref})` : ''}\n`;
      if (f.path) md += `- **Operation:** \`${f.method} ${f.path}\`\n`;
      md += `- **Description:** ${f.description}\n`;
      md += `- **Remediation:** ${f.remediation}\n\n`;
    });

    if (auditData.header_audit) {
      md += `## Live security headers (${auditData.header_audit.target_url})\n\n`;
      auditData.header_audit.checks.forEach((c) => {
        md += `- **[${c.severity}] ${c.title}** — ${c.description}\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-audit-${activeServiceId}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- derived ---------- */
  const filteredFindings = useMemo(() => {
    if (!auditData) return [];
    if (selectedSeverity === 'ALL') return auditData.static_findings;
    return auditData.static_findings.filter((f) => f.severity === selectedSeverity);
  }, [auditData, selectedSeverity]);

  /* ---------- group filtered findings by owasp_ref ---------- */
  const groupedFindings = useMemo(() => {
    const groups: Record<string, SecurityFinding[]> = {};
    filteredFindings.forEach((f) => {
      const key = f.owasp_ref || f.category || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    // Sort groups by worst severity first
    const sevRank: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2, PASS: 3 };
    return Object.entries(groups)
      .map(([key, items]) => ({
        key,
        items,
        worst: Math.min(...items.map((i) => sevRank[i.severity] ?? 9)),
      }))
      .sort((a, b) => a.worst - b.worst);
  }, [filteredFindings]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const severityCounts = useMemo(() => {
    if (!auditData) return { CRITICAL: 0, WARNING: 0, INFO: 0, PASS: 0 };
    const counts = { CRITICAL: 0, WARNING: 0, INFO: 0, PASS: 0 };
    auditData.static_findings.forEach((f) => {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    });
    return counts;
  }, [auditData]);

  const gradeDelta = prevGrade && auditData ? gradeToNum(auditData.grade) - gradeToNum(prevGrade) : 0;

  const tabs = auditData
    ? [
        { id: 'findings' as const, label: 'Findings', count: auditData.static_findings.length },
        { id: 'headers' as const, label: 'Headers', count: auditData.header_audit?.checks.length || 0 },
        { id: 'fuzzing' as const, label: 'Fuzzing', count: auditData.fuzzing_presets?.reduce((n, g) => n + g.payloads.length, 0) || 0 },
      ]
    : [];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Security & compliance audit"
      subtitle={`${activeServiceId} · OWASP API Top 10 static scanner, header probe & fuzzing suite`}
      widthClass="max-w-5xl"
    >
      <div className="flex flex-col">
        {/* ---- Score hero ---- */}
        {auditData && !loading && (
          <div
            className="px-5 py-4 flex flex-wrap items-center gap-5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {/* Grade */}
            <div
              className="w-16 h-16 rounded-[var(--r-md)] grid place-items-center shrink-0 border-2"
              style={{
                borderColor: `color-mix(in srgb, ${gradeColor(auditData.grade)} 45%, transparent)`,
                background: `color-mix(in srgb, ${gradeColor(auditData.grade)} 8%, transparent)`,
                color: gradeColor(auditData.grade),
              }}
            >
              <div className="text-[22px] font-bold leading-none" style={{ letterSpacing: '-0.03em' }}>
                {auditData.grade}
              </div>
              <div className="text-[9px] font-semibold uppercase mt-0.5" style={{ letterSpacing: '0.08em', opacity: 0.7 }}>
                grade
              </div>
            </div>

            {/* Score + bar + meta */}
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="mono text-[20px] font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {auditData.score}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                  / 100 posture score
                </span>
                {gradeDelta !== 0 && (
                  <span
                    className="inline-flex items-center gap-1 mono text-[11px] font-medium px-1.5 py-0.5 rounded ml-1"
                    style={{
                      background: gradeDelta > 0
                        ? 'color-mix(in srgb, var(--success-500) 12%, transparent)'
                        : 'color-mix(in srgb, var(--danger-500) 12%, transparent)',
                      color: gradeDelta > 0 ? 'var(--success-500)' : 'var(--danger-500)',
                    }}
                  >
                    {gradeDelta > 0 ? '↑' : '↓'} {Math.abs(gradeDelta).toFixed(1)} from {prevGrade}
                  </span>
                )}
              </div>

              {/* severity distribution bar */}
              <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }}>
                {(['CRITICAL', 'WARNING', 'INFO', 'PASS'] as const).map((sev) => {
                  const count = severityCounts[sev];
                  const total = auditData.static_findings.length || 1;
                  if (count === 0) return null;
                  const pct = (count / total) * 100;
                  return (
                    <div
                      key={sev}
                      style={{
                        width: `${pct}%`,
                        background: severityTone(sev).fg,
                      }}
                      title={`${sev}: ${count}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                <span className="mono">
                  {new Date(auditData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>·</span>
                <span>{auditData.total_issues} issue{auditData.total_issues === 1 ? '' : 's'}</span>
              </div>
            </div>

            {/* Re-run */}
            <button
              type="button"
              onClick={fetchAudit}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-medium transition-all shrink-0"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title="Re-run scan (⌘R)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Re-scan
            </button>
          </div>
        )}

        {/* ---- Tabs ---- */}
        {auditData && (
          <div
            className="flex items-center justify-between gap-3 px-5"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-1">
              {tabs.map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className="pb-2.5 px-2 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      borderBottom: active ? '2px solid var(--accent-500)' : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span
                        className="h-4 px-1.5 rounded mono text-[10px] font-semibold"
                        style={{
                          background: active ? 'var(--accent-muted)' : 'var(--bg-overlay)',
                          color: active ? 'var(--accent-500)' : 'var(--text-tertiary)',
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 pb-1">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                title="Export findings as CSV"
              >
                <FileSpreadsheet className="w-3 h-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                title="Export audit as Markdown"
              >
                <FileText className="w-3 h-3" />
                Markdown
              </button>
            </div>
          </div>
        )}

        {/* ---- Body ---- */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && !auditData && (
            <div className="py-20 flex flex-col items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-500)' }} />
              <div className="text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
                Running OWASP API Top 10 analysis…
              </div>
            </div>
          )}

          {error && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-[var(--r-sm)] text-[12px]"
              style={{
                background: 'color-mix(in srgb, var(--danger-500) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger-500) 24%, transparent)',
                color: 'var(--danger-500)',
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* ============ FINDINGS ============ */}
          {activeTab === 'findings' && auditData && (
            <>
              {/* Severity filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedSeverity('ALL')}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                  style={
                    selectedSeverity === 'ALL'
                      ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                      : { background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
                  }
                >
                  All findings
                  <span className="mono text-[10px]" style={{ opacity: 0.7 }}>{auditData.static_findings.length}</span>
                </button>
                {(['CRITICAL', 'WARNING', 'INFO', 'PASS'] as const).map((sev) => {
                  const count = severityCounts[sev];
                  if (count === 0) return null;
                  const active = selectedSeverity === sev;
                  const tone = severityTone(sev);
                  return (
                    <button
                      key={sev}
                      onClick={() => setSelectedSeverity(active ? 'ALL' : sev)}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                      style={
                        active
                          ? { background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }
                          : { background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.fg }} />
                      {sev.toLowerCase()}
                      <span className="mono text-[10px]" style={{ opacity: 0.7 }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Empty state */}
              {filteredFindings.length === 0 && (
                <div className="py-16 text-center">
                  <div
                    className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3"
                    style={{
                      background: 'color-mix(in srgb, var(--success-500) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--success-500) 24%, transparent)',
                    }}
                  >
                    <ShieldCheck className="w-5 h-5" style={{ color: 'var(--success-500)' }} />
                  </div>
                  <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    No findings in this category
                  </div>
                  <div className="text-[12px] max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {selectedSeverity === 'ALL'
                      ? 'The specification passed all static checks. Continue to the Headers tab to verify your live environment.'
                      : `No ${selectedSeverity.toLowerCase()} findings were detected. Try "All findings" or a different tab.`}
                  </div>
                </div>
              )}

              {/* Grouped findings */}
              {groupedFindings.map((group) => {
                const collapsed = collapsedGroups.has(group.key);
                return (
                  <div
                    key={group.key}
                    className="rounded-[var(--r-md)] overflow-hidden"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                      style={{ background: 'var(--bg-canvas)' }}
                    >
                      {collapsed ? (
                        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                      )}
                      <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {group.key}
                      </span>
                      <span
                        className="ml-auto shrink-0 mono text-[10.5px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-overlay)', color: 'var(--text-tertiary)' }}
                      >
                        {group.items.length}
                      </span>
                    </button>

                    {!collapsed && (
                      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        {group.items.map((f, idx) => {
                          const tone = severityTone(f.severity);
                          return (
                            <div
                              key={f.id}
                              className="p-3.5 group"
                              style={{
                                borderLeft: `3px solid ${tone.fg}`,
                                borderTop: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                              }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span
                                    className="pill"
                                    style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.bd}` }}
                                  >
                                    {f.severity.toLowerCase()}
                                  </span>
                                  {f.path && (
                                    <span
                                      className="mono text-[10.5px] px-1.5 py-0.5 rounded"
                                      style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                                    >
                                      {f.method} {f.path}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(findingToIssueMarkdown(f), f.id)}
                                  className="opacity-0 group-hover:opacity-100 shrink-0 inline-flex items-center gap-1 h-6 px-1.5 rounded transition-all text-[10.5px] font-medium"
                                  style={{ color: 'var(--text-tertiary)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                                  title="Copy as GitHub/Jira issue"
                                >
                                  {copiedKey === f.id ? (
                                    <Check className="w-3 h-3" style={{ color: 'var(--success-500)' }} />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                                {f.title}
                              </div>
                              <div className="text-[12px] leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
                                {f.description}
                              </div>
                              <div
                                className="text-[11.5px] leading-relaxed p-2 rounded"
                                style={{
                                  background: 'var(--bg-canvas)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Fix: </span>
                                {f.remediation}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ============ HEADERS ============ */}
          {activeTab === 'headers' && auditData && (
            <>
              {auditData.header_audit ? (
                <>
                  <div
                    className="flex items-center justify-between gap-3 p-3 rounded-[var(--r-sm)] mono text-[11.5px]"
                    style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
                  >
                    <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                      {auditData.header_audit.target_url}
                    </span>
                    <span
                      className="shrink-0 px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        background: auditData.header_audit.status >= 200 && auditData.header_audit.status < 300
                          ? 'color-mix(in srgb, var(--success-500) 12%, transparent)'
                          : 'color-mix(in srgb, var(--warning-500) 12%, transparent)',
                        color: auditData.header_audit.status >= 200 && auditData.header_audit.status < 300
                          ? 'var(--success-500)'
                          : 'var(--warning-500)',
                      }}
                    >
                      {auditData.header_audit.status}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {auditData.header_audit.checks.map((check) => {
                      const isPass = check.severity === 'PASS';
                      return (
                        <div
                          key={check.id}
                          className="flex items-start gap-2.5 p-3 rounded-[var(--r-sm)]"
                          style={{
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {isPass ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success-500)' }} />
                          ) : (
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning-500)' }} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                              {check.title}
                            </div>
                            <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {check.description}
                            </div>
                            {check.remediation && !isPass && (
                              <div className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Fix: </span>
                                {check.remediation}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center">
                  <div
                    className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3"
                    style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)' }}
                  >
                    <Lock className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    No target environment configured
                  </div>
                  <div className="text-[12px] max-w-sm mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                    Header probing requires an active service base URL. Set an environment in your workspace settings and re-run the audit.
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============ FUZZING ============ */}
          {activeTab === 'fuzzing' && auditData && (
            <>
              <div
                className="flex items-start gap-2 p-2.5 rounded-[var(--r-sm)] text-[11.5px]"
                style={{
                  background: 'color-mix(in srgb, var(--warning-500) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--warning-500) 22%, transparent)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Flame className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--warning-500)' }} />
                <span>
                  Requests originate from your browser. Click any payload to copy it, then paste into a field in the sandbox to test.
                </span>
              </div>

              {auditData.fuzzing_presets?.map((group) => (
                <div key={group.category}>
                  <div
                    className="text-[11px] font-semibold uppercase mb-2"
                    style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
                  >
                    {group.category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.payloads.map((p) => {
                      const isCopied = copiedKey === p.payload;
                      const riskTone = severityTone(p.risk === 'HIGH' ? 'CRITICAL' : p.risk === 'MEDIUM' ? 'WARNING' : 'INFO');
                      return (
                        <div
                          key={p.name}
                          className="p-3 rounded-[var(--r-sm)]"
                          style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {p.name}
                            </span>
                            <span
                              className="pill shrink-0"
                              style={{ background: riskTone.bg, color: riskTone.fg, border: `1px solid ${riskTone.bd}` }}
                            >
                              {p.risk.toLowerCase()}
                            </span>
                          </div>
                          <div
                            className="flex items-center justify-between gap-2 p-1.5 rounded mono text-[11px]"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                          >
                            <code className="truncate" style={{ color: 'var(--text-primary)' }}>
                              {p.payload}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                handleCopy(p.payload, p.payload);
                                if (onSelectFuzzPayload) onSelectFuzzPayload(p.payload);
                              }}
                              className="shrink-0 grid place-items-center w-6 h-6 rounded transition-colors"
                              style={{ color: 'var(--text-tertiary)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                              title="Copy payload"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3" style={{ color: 'var(--success-500)' }} />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-[10.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                            {p.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ---- Footer ---- */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}
        >
          <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {auditData ? (
              <>
                <span className="mono">⌘R</span> to re-scan · <span className="mono">⌘W</span> or ESC to close
              </>
            ) : (
              'Running initial scan…'
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};