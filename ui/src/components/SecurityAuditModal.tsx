import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Download,
  Flame,
  FileText,
} from 'lucide-react';

interface SecurityFinding {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PASS';
  title: string;
  description: string;
  path?: string;
  method?: string;
  remediation: string;
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
}

interface SecurityAuditModalProps {
  activeWorkspaceId: string;
  activeServiceId: string;
  targetEnvUrl?: string;
  onClose: () => void;
  onSelectFuzzPayload?: (payload: string) => void;
}

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
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);

  const fetchAudit = () => {
    setLoading(true);
    setError(null);

    let url = `/docs/security/audit?ws=${encodeURIComponent(activeWorkspaceId)}&svc=${encodeURIComponent(activeServiceId)}`;
    if (targetEnvUrl) {
      url += `&target_url=${encodeURIComponent(targetEnvUrl)}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Audit request returned status ${res.status}`);
        return res.json();
      })
      .then((data) => {
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
  }, [activeWorkspaceId, activeServiceId, targetEnvUrl]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayload(text);
    setTimeout(() => setCopiedPayload(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (!auditData) return;

    let md = `# API Cybersecurity Audit Report\n\n`;
    md += `**Target Service**: ${activeServiceId} (Workspace: ${activeWorkspaceId})\n`;
    md += `**Timestamp**: ${new Date(auditData.timestamp).toUTCString()}\n`;
    md += `**Overall Security Score**: ${auditData.score}/100 (Grade: ${auditData.grade})\n`;
    md += `**Findings Summary**: ${auditData.critical_count} Critical, ${auditData.warning_count} Warnings, ${auditData.pass_count} Passed Checks\n\n`;

    md += `## Static Spec Security Findings\n\n`;
    auditData.static_findings.forEach((f) => {
      md += `### [${f.severity}] ${f.title}\n`;
      md += `- **Category**: ${f.category}\n`;
      if (f.path) md += `- **Operation**: ${f.method} ${f.path}\n`;
      md += `- **Description**: ${f.description}\n`;
      md += `- **Remediation**: ${f.remediation}\n\n`;
    });

    if (auditData.header_audit) {
      md += `## Live Environment Security Headers (${auditData.header_audit.target_url})\n\n`;
      auditData.header_audit.checks.forEach((c) => {
        md += `- **[${c.severity}] ${c.title}**: ${c.description}\n`;
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

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
    if (grade.startsWith('B')) return 'text-blue-700 bg-blue-100 border-blue-300';
    if (grade.startsWith('C')) return 'text-amber-700 bg-amber-100 border-amber-300';
    return 'text-rose-700 bg-rose-100 border-rose-300';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white text-lg shadow-md">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Cybersecurity & Compliance Audit
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {activeServiceId}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                OWASP API Top 10 Static Analysis, Security Headers, and Fuzzing Payloads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Score Hero Banner */}
        {auditData && !loading && (
          <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center font-black ${getGradeColor(auditData.grade)}`}>
                <span className="text-xl leading-none">{auditData.grade}</span>
                <span className="text-[9px] uppercase tracking-tighter">Grade</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Security Posture Score
                </div>
                <div className="text-2xl font-black text-white flex items-center gap-2">
                  <span>{auditData.score} / 100</span>
                  <span className="text-xs font-normal text-slate-300">
                    ({auditData.total_issues} issues identified)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {auditData.critical_count} Critical
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {auditData.warning_count} Warnings
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {auditData.pass_count} Passed
                </span>
              </div>

              <button
                type="button"
                onClick={fetchAudit}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Re-run Audit"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('findings')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'findings'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Static Spec Findings ({auditData?.static_findings.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'headers'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Security Headers Audit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fuzzing')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'fuzzing'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Fuzzing Payloads</span>
            </button>
          </div>

          {auditData && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-700">Analyzing API Specification & Security Posture...</div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Tab 1: Static Findings */}
          {activeTab === 'findings' && auditData && (
            <div className="space-y-3">
              {auditData.static_findings.map((finding) => (
                <div
                  key={finding.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    finding.severity === 'CRITICAL'
                      ? 'bg-rose-50/50 border-rose-200'
                      : finding.severity === 'WARNING'
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-emerald-50/40 border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          finding.severity === 'CRITICAL'
                            ? 'bg-rose-600 text-white'
                            : finding.severity === 'WARNING'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {finding.category}
                      </span>
                      {finding.path && (
                        <span className="font-mono text-xs font-bold text-slate-800 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          {finding.method} {finding.path}
                        </span>
                      )}
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mb-1">{finding.title}</h4>
                  <p className="text-xs text-slate-700 mb-2">{finding.description}</p>
                  <div className="text-[11px] font-medium text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-800">Remediation:</strong> {finding.remediation}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Security Headers Audit */}
          {activeTab === 'headers' && auditData && (
            <div className="space-y-4">
              {auditData.header_audit ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono text-slate-800">
                    <span>Target: {auditData.header_audit.target_url}</span>
                    <span className="font-bold text-emerald-600">Status {auditData.header_audit.status}</span>
                  </div>
                  {auditData.header_audit.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                        check.severity === 'PASS'
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      {check.severity === 'PASS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900">{check.title}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{check.description}</div>
                        {check.remediation && check.severity !== 'PASS' && (
                          <div className="text-[11px] text-slate-700 mt-1 font-medium">
                            <strong>Remediation:</strong> {check.remediation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">No Target Environment Configured</div>
                  <div className="text-[11px] text-slate-600 max-w-md mx-auto">
                    Live security headers require an active service environment base URL (e.g. Staging or Local Dev).
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Client-Side Fuzzing Payloads */}
          {activeTab === 'fuzzing' && auditData && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Client-Side Testing</strong>: Click any payload to copy or pre-fill into the Swagger Sandbox form. Requests originate strictly from your browser.
                </span>
              </div>

              {auditData.fuzzing_presets?.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    {group.category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.payloads.map((p) => (
                      <div
                        key={p.name}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{p.name}</span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              p.risk === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-700'
                                : p.risk === 'HIGH'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {p.risk}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-800">
                          <code className="truncate">{p.payload}</code>
                          <button
                            type="button"
                            onClick={() => {
                              handleCopy(p.payload);
                              if (onSelectFuzzPayload) onSelectFuzzPayload(p.payload);
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
                            title="Copy payload"
                          >
                            {copiedPayload === p.payload ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-600">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
