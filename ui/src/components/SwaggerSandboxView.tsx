import React from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { QABar, QAStats } from './QABar';
import { Filter, FlaskConical, FileSpreadsheet } from 'lucide-react';

interface SwaggerSandboxViewProps {
  specUrl: string;
  activeModule: string;
  onModuleChange: (mod: string) => void;
  availableModules: string[];
  qaMode: boolean;
  onToggleQAMode: () => void;
  onOpenQAReport: () => void;
  qaStats: QAStats;
}

export const SwaggerSandboxView: React.FC<SwaggerSandboxViewProps> = ({
  specUrl,
  activeModule,
  onModuleChange,
  availableModules,
  qaMode,
  onToggleQAMode,
  onOpenQAReport,
  qaStats,
}) => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Contextual Sandbox Header Toolbar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Interactive API Sandbox & Tester
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scope / Tag Filter Dropdown */}
            {availableModules.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300/80 rounded-xl px-2.5 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-600 hidden sm:inline">Scope:</span>
                <select
                  value={activeModule}
                  onChange={(e) => onModuleChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer text-xs"
                >
                  <option value="all">🌟 All Endpoints</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* QA Mode Toggle */}
            <button
              onClick={onToggleQAMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                qaMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>QA Mode:</span>
              <span className={qaMode ? 'text-emerald-700' : 'text-slate-500'}>
                {qaMode ? 'Active' : 'Off'}
              </span>
            </button>

            {/* QA Report */}
            <button
              onClick={onOpenQAReport}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
              <span>QA Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* QA Stats Bar if QA mode is active */}
      {qaMode && <QABar stats={qaStats} />}

      {/* Main Swagger Explorer */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-8 shadow-xs">
          <SwaggerUI
            url={specUrl}
            docExpansion="list"
            filter={true}
            persistAuthorization={true}
            displayRequestDuration={true}
          />
        </div>
      </main>
    </div>
  );
};
