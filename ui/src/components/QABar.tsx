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
    <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Progress bar */}
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="font-bold text-slate-700 whitespace-nowrap">🧪 QA Coverage:</span>
          <div className="flex-1 max-w-xs h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-slate-600 font-mono font-semibold">
            {testedCount} / {stats.total} ({percentage}%)
          </span>
        </div>

        {/* Counter badges */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-slate-700">
            🟢 Passed: <strong className="text-emerald-600">{stats.passed}</strong>
          </span>
          <span className="text-slate-700">
            🟡 Retest: <strong className="text-amber-600">{stats.retest}</strong>
          </span>
          <span className="text-slate-700">
            🔴 Bugs: <strong className="text-red-600">{stats.failed}</strong>
          </span>
          <span className="text-slate-600">
            ⚪ Untested: <strong className="text-slate-800">{stats.untested}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
