import React from 'react';

export interface QAStats {
  passed: number;
  retest: number;
  failed: number;
  untested: number;
  total: number;
}

interface QABarProps {
  stats: QAStats;
}

export const QABar: React.FC<QABarProps> = ({ stats }) => {
  const testedCount = stats.passed + stats.retest + stats.failed;
  const percentage = stats.total > 0 ? Math.round((testedCount / stats.total) * 100) : 0;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Progress bar */}
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="font-bold text-slate-300 whitespace-nowrap">🧪 QA Coverage:</span>
          <div className="flex-1 max-w-xs h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-slate-400 font-mono font-medium">
            {testedCount} / {stats.total} ({percentage}%)
          </span>
        </div>

        {/* Counter badges */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-slate-300">
            🟢 Passed: <strong className="text-emerald-400">{stats.passed}</strong>
          </span>
          <span className="text-slate-300">
            🟡 Retest: <strong className="text-amber-400">{stats.retest}</strong>
          </span>
          <span className="text-slate-300">
            🔴 Bugs: <strong className="text-red-400">{stats.failed}</strong>
          </span>
          <span className="text-slate-400">
            ⚪ Untested: <strong>{stats.untested}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
