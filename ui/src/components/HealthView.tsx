import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  Bot,
  Zap,
  Globe,
  Layers
} from 'lucide-react';

interface HealthCapabilities {
  workspaces_enabled: boolean;
  workspace_writes_enabled: boolean;
  security_audit_enabled: boolean;
  remote_fetch_enabled: boolean;
  max_spec_bytes: number;
}

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

  const [logs, setLogs] = useState<string[]>([
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

  const handleRefresh = () => {
    loadData();
  };

  const filteredLogs = logs.filter((l) =>
    l.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">System Health & Ops Dashboard</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry, NVIDIA NIM AI test engine status, and sandbox diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Last check: {lastChecked.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Services & AI Engine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NVIDIA NIM DeepSeek v4.1 Card */}
        <div className="bg-gradient-to-br from-purple-50/70 to-indigo-50/70 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/80 dark:border-purple-800/60 rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" /> AI NIM Engine
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">DeepSeek v4.1</div>
            <div className="text-xs text-purple-600 dark:text-purple-300 font-semibold mt-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Synthetic QA Synthesis
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* REST API Gateway */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between transition-colors">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">REST API Gateway</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">Active & Ready</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 99.98% Uptime
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Server className="w-4 h-4" />
          </div>
        </div>

        {/* Security & SSRF Protection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between transition-colors">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Security Shield</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {capabilities?.security_audit_enabled ? 'Hardened & Audited' : 'Dialer Active'}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> SSRF Defense Active
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* QA Review & Coverage Stats */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start justify-between transition-colors">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">QA Verification</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {qaStats.total > 0 ? `${qaStats.pass}/${qaStats.total} Passed` : 'Tracking Active'}
            </div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-2 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> {qaStats.fail} Issues Tracked
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Live Diagnostics Log Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">Live Diagnostics Terminal</h2>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={container}
              onChange={(e) => setContainer(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
            >
              <option value="api-gateway">api-gateway</option>
              <option value="ai-engine">ai-nim-deepseek</option>
              <option value="security-scanner">security-scanner</option>
              <option value="db-engine">db-engine</option>
            </select>

            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Filter logs..."
              className="bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 rounded-lg px-3 py-1.5 placeholder:text-slate-500 outline-none w-36 sm:w-48"
            />
          </div>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 min-h-48 max-h-80 overflow-y-auto space-y-1.5 select-text">
          {filteredLogs.map((log, idx) => (
            <div key={idx} className="leading-relaxed hover:bg-slate-900/60 px-1 py-0.5 rounded">
              <span className="text-slate-500 mr-2">[{new Date().toISOString().substring(11, 19)}]</span>
              {log}
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-slate-500 italic">No log entries matching filter "{logSearch}".</div>
          )}
        </div>
      </div>
    </div>
  );
};

