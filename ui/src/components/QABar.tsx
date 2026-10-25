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

const Stat: React.FC<{
  dot: string;
  label: string;
  value: number;
}> = ({ dot, label, value }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <span
      className="w-[6px] h-[6px] rounded-full shrink-0"
      style={{ background: dot }}
      aria-hidden="true"
    />
    <span className="text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
      {label}
    </span>
    <span
      className="mono text-[11.5px]"
      style={{
        color: value > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontWeight: 500,
      }}
    >
      {value}
    </span>
  </span>
);

export const QABar: React.FC<QABarProps> = ({ stats }) => {
  const testedCount = stats.passed + stats.retest + stats.failed;
  const percentage = stats.total > 0 ? Math.round((testedCount / stats.total) * 100) : 0;

  return (
    <div
      className="px-4 py-2"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Coverage bar */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
          <span
            className="text-[11.5px] font-medium whitespace-nowrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            Coverage
          </span>
          <div
            className="flex-1 max-w-[260px] h-[5px] rounded-full overflow-hidden"
            style={{ background: 'var(--bg-overlay)' }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="QA coverage"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, background: 'var(--accent-500)' }}
            />
          </div>
          <span
            className="mono text-[11.5px] whitespace-nowrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {percentage}%
          </span>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-4 flex-wrap">
          <Stat dot="var(--success-500)" label="Passed" value={stats.passed} />
          <Stat dot="var(--warning-500)" label="Retest" value={stats.retest} />
          <Stat dot="var(--danger-500)" label="Bugs" value={stats.failed} />
          <Stat dot="var(--text-tertiary)" label="Untested" value={stats.untested} />
        </div>

        {/* Total */}
        <span
          className="mono text-[11px] ml-auto hidden sm:inline"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {testedCount} / {stats.total}
        </span>
      </div>
    </div>
  );
};