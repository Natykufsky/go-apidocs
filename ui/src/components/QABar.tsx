import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, FlaskConical } from 'lucide-react';

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
          <span className="font-bold text-slate-700 whitespace-nowrap inline-flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            QA Coverage:
          </span>
          <div className="flex-1 max-w-xs h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-slate-600 font-mono font-semibold">
            {testedCount} / {stats.total} ({percentage}%)
          </span>
        </div>

        {/* Counter badges */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-slate-700 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            Passed: <strong className="text-emerald-600">{stats.passed}</strong>
          </span>
          <span className="text-slate-700 inline-flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Retest: <strong className="text-amber-600">{stats.retest}</strong>
          </span>
          <span className="text-slate-700 inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
            Bugs: <strong className="text-red-600">{stats.failed}</strong>
          </span>
          <span className="text-slate-600 inline-flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            Untested: <strong className="text-slate-800">{stats.untested}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
