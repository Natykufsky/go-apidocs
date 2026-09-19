import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Cpu, RefreshCw, Terminal, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export const HealthView: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [logSearch, setLogSearch] = useState('');
  const [container, setContainer] = useState('api-gateway');
  const [logs, setLogs] = useState<string[]>([
    '[system] Gateway reverse-proxy initialized on :8080',
    '[database] PostgreSQL connection pool healthy (10/50 active)',
    '[redis] Cache node cluster connected (latency: 1.2ms)',
    '[openapi] Swagger JSON specification validated against v3.0.3 standard',
    '[healthcheck] All core subservices reporting 200 OK',
  ]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastChecked(new Date());
      setRefreshing(false);
    }, 600);
  };

  const filteredLogs = logs.filter((l) =>
    l.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Health & Ops Dashboard</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              All Systems Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status, cluster latency, database connections, and console logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Last check: {lastChecked.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">REST API Gateway</div>
            <div className="text-lg font-bold text-slate-900 mt-1">Active & Ready</div>
            <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 99.98% Uptime
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Server className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PostgreSQL DB</div>
            <div className="text-lg font-bold text-slate-900 mt-1">Connected</div>
            <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 2.1ms Query Avg
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Redis Cache</div>
            <div className="text-lg font-bold text-slate-900 mt-1">Synchronized</div>
            <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 0.8ms Hit Latency
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Queues & Webhooks</div>
            <div className="text-lg font-bold text-slate-900 mt-1">0 Pending</div>
            <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Delivery SLA
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Live Log Console */}
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
              <option value="db-engine">db-engine</option>
              <option value="worker-node">worker-node</option>
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
