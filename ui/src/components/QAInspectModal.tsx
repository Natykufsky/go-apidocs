import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Save,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { QARecord } from './QAReportModal';

interface QAInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpointKey: string;
  endpointsList: string[];
  qaData: Record<string, QARecord>;
  onSaveRecord: (endpoint: string, status: 'passed' | 'retest' | 'failed' | 'untested', comment: string) => void;
  onSelectEndpoint: (endpoint: string) => void;
}

export const QAInspectModal: React.FC<QAInspectModalProps> = ({
  isOpen,
  onClose,
  endpointKey,
  endpointsList,
  qaData,
  onSaveRecord,
  onSelectEndpoint,
}) => {
  const record = qaData[endpointKey] || { status: 'untested', comment: '', tested_at: '' };

  const [status, setStatus] = useState<'passed' | 'retest' | 'failed' | 'untested'>(record.status || 'untested');
  const [comment, setComment] = useState(record.comment || '');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const current = qaData[endpointKey] || { status: 'untested', comment: '', tested_at: '' };
    setStatus(current.status || 'untested');
    setComment(current.comment || '');
    setSavedNotice(false);
  }, [endpointKey, qaData]);

  if (!isOpen || !endpointKey) return null;

  const currentIndex = endpointsList.indexOf(endpointKey);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < endpointsList.length - 1;

  const handleSave = () => {
    onSaveRecord(endpointKey, status, comment);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handlePrev = () => {
    if (hasPrev) {
      handleSave();
      onSelectEndpoint(endpointsList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      handleSave();
      onSelectEndpoint(endpointsList[currentIndex + 1]);
    }
  };

  const parts = endpointKey.split(' ');
  const method = parts[0] || 'GET';
  const path = parts.slice(1).join(' ') || endpointKey;

  const getMethodBadgeClass = (m: string) => {
    switch (m.toUpperCase()) {
      case 'GET':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'POST':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PUT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PATCH':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
              🧪
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Interactive QA Endpoint Inspector</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Review endpoint testing compliance & record bug details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentIndex >= 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-md">
                {currentIndex + 1} of {endpointsList.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {/* Endpoint Identity Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${getMethodBadgeClass(method)}`}>
              {method}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 font-mono break-all">{path}</div>
              {record.tested_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last synced: {record.tested_at}</span>
                </div>
              )}
            </div>
          </div>

          {/* QA Verification Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Testing Status Result
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('passed')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  status === 'passed'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 ${status === 'passed' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Passed (Working)</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('retest')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  status === 'retest'
                    ? 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 ${status === 'retest' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Needs Retest</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('failed')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  status === 'failed'
                    ? 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <XCircle className={`w-5 h-5 ${status === 'failed' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Failed / Bug</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('untested')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  status === 'untested'
                    ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-400/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <HelpCircle className={`w-5 h-5 ${status === 'untested' ? 'text-slate-700' : 'text-slate-400'}`} />
                <span>Not Tested</span>
              </button>
            </div>
          </div>

          {/* QA Comment & Notes Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                QA Bug Notes & Verification Comments
              </label>
              <span className="text-[11px] text-slate-400">Supports Markdown notes</span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Expected 200 OK with payload { id, status }, received 500 error when sending empty phone array. Steps to reproduce..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          {/* Stepper Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={!hasPrev}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNext}
              disabled={!hasNext}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Save & Confirm */}
          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="text-xs font-bold text-emerald-600 animate-in fade-in">
                ✅ Saved & Synced!
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Sync Server</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
