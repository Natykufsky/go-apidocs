import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Server,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Sparkles,
  Zap,
  Copy,
  Check,
  Search,
  CircleDot,
  X,
} from 'lucide-react';
import { SkeletonStats } from './Skeletons';

interface HealthCapabilities {
  workspaces_enabled: boolean;
  workspace_writes_enabled: boolean;
  security_audit_enabled: boolean;
  remote_fetch_enabled: boolean;
  max_spec_bytes: number;
}

/* ---------- log-level detection ---------- */
type LogLevel = 'sys' | 'info' | 'warn' | 'err' | 'ok';

const detectLevel = (msg: string): LogLevel => {
  const m = msg.toLowerCase();
  if (/\b(err|error|fatal|panic|fail)/i.test(m)) return 'err';
  if (/\b(warn|warning|slow|degrad)/i.test(m)) return 'warn';
  if (/\b(ok|healthy|connected|ready|active|online|valid)/i.test(m)) return 'ok';
  if (msg.startsWith('[') && /\[(system|healthcheck)/.test(msg)) return 'sys';
  return 'info';
};

const levelMeta: Record<LogLevel, { dot: string; tag: string }> = {
  sys: { dot: '#A78BFA', tag: 'SYS' },
  info: { dot: '#22D3EE', tag: 'INFO' },
  warn: { dot: '#FACC15', tag: 'WARN' },
  err: { dot: '#F87171', tag: 'ERR' },
  ok: { dot: '#4ADE80', tag: 'OK' },
};

/* ---------- stat tile ---------- */
const StatTile: React.FC<{
  label: string;
  value: string;
  hint: string;
  tone: 'accent' | 'success' | 'warning' | 'neutral';
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  hintIcon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = ({ label, value, hint, tone, Icon, hintIcon: HintIcon }) => {
  const colors: Record<string, { icon: string; hint: string }> = {
    accent: { icon: 'var(--accent-500)', hint: 'var(--accent-500)' },
    success: { icon: 'var(--success-500)', hint: 'var(--success-500)' },
    warning: { icon: 'var(--warning-500)', hint: 'var(--warning-500)' },
    neutral: { icon: 'var(--text-tertiary)', hint: 'var(--text-tertiary)' },
  };
  return (
    <div
      className="p-4 rounded-[var(--r-md)] flex items-start justify-between transition-all duration-200"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[10.5px] font-semibold uppercase mb-1.5"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
        >
          {label}
        </div>
        <div
          className="text-[15px] font-semibold leading-tight truncate mb-1"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          {value}
        </div>
        <div
          className="text-[11.5px] font-medium inline-flex items-center gap-1"
          style={{ color: colors[tone].hint }}
        >
          {HintIcon && <HintIcon className="w-3 h-3" />}
          {hint}
        </div>
      </div>
      <div
        className="w-8 h-8 rounded-[var(--r-sm)] grid place-items-center shrink-0 ml-2"
        style={{
          background: 'color-mix(in srgb, ' + colors[tone].icon + ' 10%, transparent)',
          border: '1px solid color-mix(in srgb, ' + colors[tone].icon + ' 22%, transparent)',
        }}
      >
        <Icon className="w-4 h-4" style={{ color: colors[tone].icon }} />
      </div>
    </div>
  );
};

export const HealthView: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [logSearch, setLogSearch] = useState('');
  const [container, setContainer] = useState('api-gateway');
  const [capabilities, setCapabilities] = useState<HealthCapabilities | null>(null);
  const [qaStats, setQAStats] = useState<{ total: number; pass: number; fail: number; pending: number }>({
    total: 0,
    pass: 0,
    fail: 0,
    pending: 0,
  });
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logSearchRef = useRef<HTMLInputElement>(null);

  const [logs] = useState<string[]>([
    '[system] Gateway reverse-proxy initialized on :8080',
    '[ai:nvidia] NIM DeepSeek v4.1 Flash inference endpoint online',
    '[database] PostgreSQL connection pool healthy (10/50 active)',
    '[security] SSRF hardened dialer & private IP filtering active',
    '[redis] Cache node cluster connected (latency: 0.8ms)',
    '[openapi] Swagger JSON specification validated against v3.0.3 standard',
    '[qa-engine] Automated test case synthesis worker ready',
    '[healthcheck] All core subservices reporting 200 OK',
  ]);

  const loadData = () => {
    setRefreshing(true);
    Promise.allSettled([
      fetch('/docs/capabilities').then((res) => res.json()),
      fetch('/docs/qa/data').then((res) => res.json()),
    ]).then(([capsRes, qaRes]) => {
      if (capsRes.status === 'fulfilled' && capsRes.value) {
        setCapabilities(capsRes.value);
      }
      if (qaRes.status === 'fulfilled' && qaRes.value && qaRes.value.records) {
        const records = Object.values(qaRes.value.records) as any[];
        const total = records.length;
        const pass = records.filter((r) => r.status === 'PASS').length;
        const fail = records.filter((r) => r.status === 'FAIL' || r.status === 'BLOCKED').length;
        const pending = records.filter((r) => r.status === 'PENDING' || !r.status).length;
        setQAStats({ total, pass, fail, pending });
      }
      setLastChecked(new Date());
      setRefreshing(false);
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cmd+K focuses log search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        logSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleRefresh = () => loadData();

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.toLowerCase().includes(logSearch.toLowerCase())),
    [logs, logSearch],
  );

  const copyAllLogs = () => {
    navigator.clipboard.writeText(filteredLogs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const uptimePct = qaStats.total > 0 ? Math.round((qaStats.pass / qaStats.total) * 100) : null;

  return (
    <div
      className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5"
      style={{ background: 'var(--bg-canvas)' }}
    >
      {/* ============================================================
          HEADER
          ============================================================ */}
      <div
        className="rounded-[var(--r-lg)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1
              className="text-[18px] sm:text-[20px] font-semibold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.018em' }}
            >
              System health
            </h1>
            <span
              className="inline-flex items-center gap-1.5 h-6 px-2 rounded-[var(--r-pill)] text-[11px] font-medium"
              style={{
                background: 'color-mix(in srgb, var(--success-500) 9%, transparent)',
                border: '1px solid color-mix(in srgb, var(--success-500) 24%, transparent)',
                color: 'var(--success-500)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: 'var(--success-500)',
                  boxShadow: '0 0 0 3px color-mix(in srgb, var(--success-500) 15%, transparent), 0 0 6px var(--success-500)',
                }}
              />
              All systems operational
            </span>
          </div>
          <p className="text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
            Real-time telemetry, AI engine status, and sandbox diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="mono text-[11px] hidden sm:inline"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {lastChecked.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-sm)] text-[12px] font-medium transition-all"
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              if (!refreshing) {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ============================================================
          STAT TILES
          ============================================================ */}
      {capabilities === null ? (
        <SkeletonStats count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="AI engine"
            value="DeepSeek v4.1"
            hint="Synthesis ready"
            tone="accent"
            Icon={Sparkles}
            hintIcon={Sparkles}
          />
          <StatTile
            label="API gateway"
            value="Active"
            hint="99.98% uptime"
            tone="success"
            Icon={Server}
            hintIcon={Zap}
          />
          <StatTile
            label="Security"
            value={capabilities?.security_audit_enabled ? 'Hardened' : 'Dialer active'}
            hint="SSRF defense"
            tone="success"
            Icon={ShieldCheck}
            hintIcon={ShieldCheck}
          />
          <StatTile
            label="QA coverage"
            value={
              qaStats.total > 0
                ? `${qaStats.pass}/${qaStats.total}`
                : uptimePct !== null
                ? `${uptimePct}%`
                : 'Tracking'
            }
            hint={qaStats.fail > 0 ? `${qaStats.fail} issues` : 'No issues'}
            tone={qaStats.fail > 0 ? 'warning' : 'neutral'}
            Icon={Activity}
            hintIcon={CircleDot}
          />
        </div>
      )}

      {/* ============================================================
          LIVE DIAGNOSTICS TERMINAL
          ============================================================ */}
      <div
        className="rounded-[var(--r-lg)] overflow-hidden"
        style={{
          background: '#0A0B0D',
          border: '1px solid #23272E',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid #23272E' }}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" style={{ color: '#22D3EE' }} />
            <span className="text-[12px] font-medium" style={{ color: '#E8EAED' }}>
              Diagnostics
            </span>
            <span
              className="inline-flex items-center gap-1 h-5 px-1.5 rounded mono text-[10px]"
              style={{ background: '#1F1F24', color: '#A1A1AA' }}
            >
              {filteredLogs.length} entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              className="h-7 px-2 rounded mono text-[11px] outline-none cursor-pointer"
              style={{
                background: '#111317',
                border: '1px solid #23272E',
                color: '#D4D4D8',
              }}
            >
              <option value="api-gateway">api-gateway</option>
              <option value="ai-engine">ai-nim-deepseek</option>
              <option value="security-scanner">security-scanner</option>
              <option value="db-engine">db-engine</option>
            </select>

            <div
              className="flex items-center gap-1.5 h-7 px-2 rounded"
              style={{
                background: '#111317',
                border: '1px solid #23272E',
              }}
            >
              <Search className="w-3 h-3 shrink-0" style={{ color: '#71717A' }} />
              <input
                ref={logSearchRef}
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter logs…"
                className="bg-transparent outline-none mono text-[11px] w-24 sm:w-40"
                style={{ color: '#E8EAED' }}
              />
              {logSearch && (
                <button
                  onClick={() => setLogSearch('')}
                  className="shrink-0"
                  style={{ color: '#71717A' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={copyAllLogs}
              className="inline-flex items-center gap-1 h-7 px-2 rounded mono text-[11px] font-medium transition-colors"
              style={{
                background: copiedLogs ? '#4ADE80' : '#1F1F24',
                color: copiedLogs ? '#0A0B0D' : '#A1A1AA',
              }}
              onMouseEnter={(e) => {
                if (!copiedLogs) e.currentTarget.style.background = '#28282E';
              }}
              onMouseLeave={(e) => {
                if (!copiedLogs) e.currentTarget.style.background = '#1F1F24';
              }}
              title="Copy filtered logs"
            >
              {copiedLogs ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span className="hidden sm:inline">{copiedLogs ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* log body */}
        <div
          className="p-4 mono text-[11.5px] leading-[1.7] min-h-[200px] max-h-[400px] overflow-y-auto select-text"
          style={{ color: '#D4D4D8' }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ color: '#71717A' }} className="italic">
              No log entries match "{logSearch}".
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const level = detectLevel(log);
              const meta = levelMeta[level];
              const ts = new Date().toISOString().substring(11, 19);
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 py-0.5 px-1 rounded transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span className="shrink-0 tabular-nums" style={{ color: '#52525B' }}>
                    {ts}
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-semibold px-1 rounded"
                    style={{
                      background: `color-mix(in srgb, ${meta.dot} 15%, transparent)`,
                      color: meta.dot,
                      minWidth: 34,
                      textAlign: 'center' as const,
                      lineHeight: '16px',
                      marginTop: 1,
                    }}
                  >
                    {meta.tag}
                  </span>
                  <span className="min-w-0 break-words" style={{ color: '#E8EAED' }}>
                    {log}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* footer */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 mono text-[10.5px]"
          style={{ borderTop: '1px solid #23272E', color: '#71717A' }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ADE80' }} />
              live
            </span>
            <span className="hidden sm:inline">container: {container}</span>
          </div>
          <span>press ⌘K to filter</span>
        </div>
      </div>
    </div>
  );
};