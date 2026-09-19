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
    a.download = `QA_Report_${(title || 'API').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-base font-bold text-slate-900">
              QA Audit & Test Report (Markdown Export)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-slate-800 bg-slate-50">
          <pre className="p-4 bg-white border border-slate-200 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner text-slate-800">
            {mdContent}
          </pre>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-white">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all team QA test records?')) {
                onReset();
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-all"
          >
            🗑️ Reset All QA Data
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all"
            >
              {copied ? '✅ Copied to Clipboard!' : '📋 Copy Markdown'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
            >
              ⬇️ Download .md Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
