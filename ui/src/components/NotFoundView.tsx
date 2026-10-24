import React from "react";
import { Compass, ArrowLeft } from "lucide-react";

export const NotFoundView: React.FC<{ onNavigateHome: () => void }> = ({
  onNavigateHome,
}) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
      <Compass className="w-8 h-8 text-slate-400" />
    </div>
    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
      404
    </h1>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
      This page doesn't exist. It may have been moved, or the link is out of
      date.
    </p>
    <button
      onClick={onNavigateHome}
      className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Home
    </button>
  </div>
);
