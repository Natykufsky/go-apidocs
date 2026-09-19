import React, { useState } from 'react';

export interface QARecord {
  status: 'passed' | 'retest' | 'failed' | 'untested';
  comment?: string;
  tested_at?: string;
}

interface QAReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  qaData: Record<string, QARecord>;
  onReset: () => void;
}

export const QAReportModal: React.FC<QAReportModalProps> = ({
  isOpen,
  onClose,
  title,
  qaData,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateMarkdown = () => {
    let md = `# ${title || 'REST API'} — QA Testing & Verification Report\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    md += `| Method & Endpoint | Status | Last Tested | QA Comments / Bug Notes |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    for (const ep in qaData) {
      const item = qaData[ep];
      let statusIcon = '⚪ Untested';
      if (item.status === 'passed') statusIcon = '🟢 PASSED';
      if (item.status === 'failed') statusIcon = '🔴 FAILED / BUG';
      if (item.status === 'retest') statusIcon = '🟡 RETEST';

      const comment = (item.comment || '-').replace(/\n/g, '<br>');
      md += `| \`${ep}\` | ${statusIcon} | ${item.tested_at || '-'} | ${comment} |\n`;
    }
    return md;
  };

  const mdContent = generateMarkdown();

  const handleCopy = () => {
    navigator.clipboard.writeText(mdContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api_qa_report_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-base font-bold text-white">Live QA Testing Audit Report</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col gap-3 overflow-hidden">
          <p className="text-xs text-slate-400">
            Export or copy this GitHub Flavored Markdown audit report to track test results and bugs with your development team.
          </p>
          <textarea
            readOnly
            value={mdContent}
            className="w-full flex-1 min-h-[300px] bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none resize-none selection:bg-indigo-500/30"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset all team QA notes and comments on the server?')) {
                onReset();
              }
            }}
            className="px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
          >
            🗑️ Reset QA Data
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              {copied ? '✅ Copied!' : '📋 Copy Markdown'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/30 transition-colors"
            >
              📥 Download .md
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
