import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Save,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Code2,
  Sparkles,
  Zap,
  Activity,
  FileText,
  Eye,
  Edit3,
  Copy,
  Check,
} from 'lucide-react';
import { Modal } from './Modal';
import { QARecord } from './QAReportModal';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface QAInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  endpointsList: string[];
  qaData: Record<string, QARecord>;
  onSaveRecord: (
    endpoint: string,
    status: 'passed' | 'retest' | 'failed' | 'untested',
    comment: string,
  ) => void;
  onSelectEndpoint: (endpoint: string) => void;
  onOpenSnippetGenerator?: (endpoint: string) => void;
  onOpenAIGenerator?: (endpoint: string) => void;
}

const COMMON_TAGS = [
  '401 Unauthorized (missing token)',
  '500 Server error on empty body',
  '429 Rate limited under load',
  'Schema validation mismatch',
  'Slow response (>500ms)',
  'Missing CORS headers',
  'Payload sanitization verified',
];

export const QAInspectModal: React.FC<QAInspectModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  endpointsList,
  qaData,
  onSaveRecord,
  onSelectEndpoint,
  onOpenSnippetGenerator,
  onOpenAIGenerator,
}) => {
  const record = qaData[endpointKey] || { status: 'untested', comment: '', tested_at: '' };

  const [status, setStatus] = useState<'passed' | 'retest' | 'failed' | 'untested'>(
    record.status || 'untested',
  );
  const [comment, setComment] = useState(record.comment || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const current = qaData[endpointKey] || { status: 'untested', comment: '', tested_at: '' };
    setStatus(current.status || 'untested');
    setComment(current.comment || '');
    setSavedNotice(false);
    setActiveTab('edit');
  }, [endpointKey, qaData]);

  const currentIndex = endpointsList.indexOf(endpointKey);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < endpointsList.length - 1;

  const handleSave = () => {
    onSaveRecord(endpointKey, status, comment);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handlePrev = () => {
    if (hasPrev) {
      handleSave();
      onSelectEndpoint(endpointsList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      handleSave();
      onSelectEndpoint(endpointsList[currentIndex + 1]);
    }
  };

  const handleCopyEndpoint = () => {
    if (!endpointKey) return;
    navigator.clipboard.writeText(endpointKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    });
  };

  const handleInsertTag = (tag: string) => {
    setComment((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `• ${tag}`;
      return `${trimmed}\n• ${tag}`;
    });
  };

  const parts = endpointKey.split(' ');
  const method = parts[0] || 'GET';
  const path = parts.slice(1).join(' ') || endpointKey;

  // Keyboard triage: J/K navigate, 1=passed, 2=retest, 3=failed, 4=untested, s/enter=save
  useEffect(() => {
    if (!isOpen || !endpointKey) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'j') {
        e.preventDefault();
        handleNext();
      } else if (k === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (k === '1') {
        setStatus('passed');
      } else if (k === '2') {
        setStatus('retest');
      } else if (k === '3') {
        setStatus('failed');
      } else if (k === '4') {
        setStatus('untested');
      } else if (k === 's' || k === 'enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, endpointKey, status, comment, hasPrev, hasNext, currentIndex]);

  const renderedPreview = useMemo(() => {
    if (!comment.trim()) {
      return '<p class="text-[var(--text-tertiary)] italic">No comments or notes entered yet.</p>';
    }
    try {
      return DOMPurify.sanitize(marked.parse(comment) as string);
    } catch {
      return comment;
    }
  }, [comment]);

  if (!isOpen || !endpointKey) return null;

  const methodTone: Record<string, { bg: string; text: string; border: string }> = {
    GET: { bg: 'rgba(37, 99, 235, 0.12)', text: '#3b82f6', border: 'rgba(37, 99, 235, 0.3)' },
    POST: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
    PUT: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
    PATCH: { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
    DELETE: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  };
  const tone = methodTone[method.toUpperCase()] || {
    bg: 'var(--bg-overlay)',
    text: 'var(--text-secondary)',
    border: 'var(--border-subtle)',
  };

  const execution = record.execution_summary;
  const stress = record.stress_metrics;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      widthClass="max-w-3xl"
      hideHeader={true}
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Command bar header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{
            background: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-[var(--r-sm)] grid place-items-center shrink-0"
              style={{
                background: 'var(--accent-muted)',
                color: 'var(--accent-500)',
                border: '1px solid color-mix(in srgb, var(--accent-500) 25%, transparent)',
              }}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  QA Endpoint Inspector
                </h2>
                {currentIndex >= 0 && (
                  <span
                    className="mono text-[10.5px] px-1.5 py-0.5 rounded-[var(--r-sm)]"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {currentIndex + 1} of {endpointsList.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                Triage compliance, record bugs & synthesize automated suites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenAIGenerator && (
              <button
                type="button"
                onClick={() => onOpenAIGenerator(endpointKey)}
                title="Synthesize AI test suite"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                style={{
                  background: 'var(--ai-muted)',
                  color: 'var(--ai-400)',
                  border: '1px solid color-mix(in srgb, var(--ai-500) 30%, transparent)',
                }}
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">AI Suite</span>
              </button>
            )}

            {onOpenSnippetGenerator && (
              <button
                type="button"
                onClick={() => onOpenSnippetGenerator(endpointKey)}
                title="Generate pre-authenticated code snippet"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--r-sm)] text-[11.5px] font-medium transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Code2 className="w-3 h-3 text-[var(--accent-500)]" />
                <span className="hidden sm:inline">Snippet</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[var(--r-sm)] transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1" style={{ background: 'var(--bg-surface)' }}>
          {/* Endpoint Identity Banner */}
          <div
            className="p-3.5 rounded-[var(--r-md)] flex items-start justify-between gap-3"
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <span
                className="mono text-[11px] font-bold px-2 py-0.5 rounded-[4px] shrink-0 uppercase"
                style={{
                  background: tone.bg,
                  color: tone.text,
                  border: `1px solid ${tone.border}`,
                }}
              >
                {method}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="mono text-[12.5px] font-semibold break-all leading-tight select-all"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {path}
                </div>
                {record.tested_at && (
                  <div className="flex items-center gap-1.5 text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    <Clock className="w-3 h-3" />
                    <span>Last synced: {record.tested_at}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyEndpoint}
              title="Copy endpoint key"
              className="p-1.5 rounded-[var(--r-sm)] transition-colors shrink-0"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: copiedKey ? 'var(--success-500)' : 'var(--text-secondary)',
              }}
            >
              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Telemetry Metrics Card (if AI execution or stress testing was run) */}
          {(execution || stress) && (
            <div
              className="p-3.5 rounded-[var(--r-md)] grid grid-cols-2 sm:grid-cols-4 gap-2.5"
              style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {execution && (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      AI Pass Rate
                    </span>
                    <span
                      className="mono text-[14px] font-bold mt-0.5"
                      style={{
                        color: execution.pass_rate >= 90 ? 'var(--success-500)' : 'var(--warning-500)',
                      }}
                    >
                      {execution.pass_rate}% ({execution.passed}/{execution.total_tests})
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      AI Latency
                    </span>
                    <span className="mono text-[14px] font-bold mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {execution.avg_latency_ms}ms
                    </span>
                  </div>
                </>
              )}

              {stress && (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      Peak Throughput
                    </span>
                    <span className="mono text-[14px] font-bold mt-0.5" style={{ color: 'var(--accent-500)' }}>
                      {stress.rps.toFixed(1)} req/s
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      P95 Latency
                    </span>
                    <span
                      className="mono text-[14px] font-bold mt-0.5"
                      style={{
                        color: stress.p95_latency_ms > 200 ? 'var(--danger-500)' : 'var(--success-500)',
                      }}
                    >
                      {stress.p95_latency_ms.toFixed(1)}ms
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Test Status Radio Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Verification Status
              </label>
              <span className="mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                Hotkeys: 1=Pass, 2=Retest, 3=Fail, 4=Untested
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setStatus('passed')}
                className="p-3 rounded-[var(--r-md)] text-left flex flex-col gap-1.5 transition-all cursor-pointer relative"
                style={{
                  background: status === 'passed' ? 'rgba(22, 163, 74, 0.12)' : 'var(--bg-canvas)',
                  border: `1px solid ${status === 'passed' ? 'var(--success-500)' : 'var(--border-subtle)'}`,
                  color: status === 'passed' ? 'var(--success-500)' : 'var(--text-secondary)',
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="kbd text-[9.5px]">1</span>
                </div>
                <span className="text-[12px] font-semibold leading-tight">Passed</span>
                <span className="text-[10px] opacity-70">Working normally</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('retest')}
                className="p-3 rounded-[var(--r-md)] text-left flex flex-col gap-1.5 transition-all cursor-pointer relative"
                style={{
                  background: status === 'retest' ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-canvas)',
                  border: `1px solid ${status === 'retest' ? 'var(--warning-500)' : 'var(--border-subtle)'}`,
                  color: status === 'retest' ? 'var(--warning-500)' : 'var(--text-secondary)',
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="kbd text-[9.5px]">2</span>
                </div>
                <span className="text-[12px] font-semibold leading-tight">Needs Retest</span>
                <span className="text-[10px] opacity-70">Requires review</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('failed')}
                className="p-3 rounded-[var(--r-md)] text-left flex flex-col gap-1.5 transition-all cursor-pointer relative"
                style={{
                  background: status === 'failed' ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-canvas)',
                  border: `1px solid ${status === 'failed' ? 'var(--danger-500)' : 'var(--border-subtle)'}`,
                  color: status === 'failed' ? 'var(--danger-500)' : 'var(--text-secondary)',
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <XCircle className="w-4 h-4" />
                  <span className="kbd text-[9.5px]">3</span>
                </div>
                <span className="text-[12px] font-semibold leading-tight">Failed / Bug</span>
                <span className="text-[10px] opacity-70">Identified defect</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('untested')}
                className="p-3 rounded-[var(--r-md)] text-left flex flex-col gap-1.5 transition-all cursor-pointer relative"
                style={{
                  background: status === 'untested' ? 'var(--bg-overlay)' : 'var(--bg-canvas)',
                  border: `1px solid ${status === 'untested' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                  color: status === 'untested' ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <HelpCircle className="w-4 h-4" />
                  <span className="kbd text-[9.5px]">4</span>
                </div>
                <span className="text-[12px] font-semibold leading-tight">Untested</span>
                <span className="text-[10px] opacity-70">Not verified</span>
              </button>
            </div>
          </div>

          {/* Quick-Tag Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Quick Triage Findings
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleInsertTag(tag)}
                  className="text-[11px] px-2 py-0.5 rounded-[var(--r-sm)] transition-colors cursor-pointer"
                  style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* QA Comment & Notes with Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--accent-500)' }} />
                Notes & Reproduction Steps
              </label>

              <div
                className="inline-flex items-center p-0.5 rounded-[var(--r-sm)]"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('edit')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-medium transition-colors"
                  style={
                    activeTab === 'edit'
                      ? {
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-xs)',
                        }
                      : { color: 'var(--text-tertiary)' }
                  }
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-medium transition-colors"
                  style={
                    activeTab === 'preview'
                      ? {
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-xs)',
                        }
                      : { color: 'var(--text-tertiary)' }
                  }
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>
            </div>

            {activeTab === 'edit' ? (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Markdown supported: e.g. Steps to reproduce, expected status vs observed payload, boundary findings..."
                rows={4}
                className="w-full rounded-[var(--r-md)] p-3 text-[12px] mono outline-none leading-relaxed transition-all resize-y"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              />
            ) : (
              <div
                className="markdown-body p-3 rounded-[var(--r-md)] min-h-[96px] text-[12px] leading-relaxed overflow-y-auto"
                style={{
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
                dangerouslySetInnerHTML={{ __html: renderedPreview }}
              />
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3"
          style={{
            background: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {/* Stepper Navigation */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              title="Previous endpoint (K)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[var(--r-sm)] text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              title="Next endpoint (J)"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Save & Confirm */}
          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="mono text-[11px] font-medium" style={{ color: 'var(--success-500)' }}>
                ✓ Synced to QA Server
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--r-sm)] text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                background: 'var(--accent-500)',
                color: 'var(--text-inverse)',
                boxShadow: 'var(--shadow-xs)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-400)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-500)';
              }}
              title="Save & Sync (S / Enter)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Sync</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
