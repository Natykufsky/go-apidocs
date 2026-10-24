import React from "react";

/** Shimmer pulse block */
export const SkeletonBlock: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <div
    className={`rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse ${className}`}
    aria-hidden="true"
  />
);

/** Row of KPI stat card skeletons */
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div
    className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    aria-busy="true"
    aria-label="Loading statistics"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
      >
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-8 w-16" />
      </div>
    ))}
  </div>
);

/** Full-width section skeleton */
export const SkeletonSection: React.FC<{ lines?: number }> = ({
  lines = 3,
}) => (
  <div className="space-y-3" aria-busy="true">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBlock
        key={i}
        className={`h-12 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
      />
    ))}
  </div>
);
