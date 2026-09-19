import React from 'react';
import { BookOpen, Terminal, Activity, FileCode, CheckCircle2, Server, Layers, Cpu } from 'lucide-react';
import { NavConfig } from './Navbar';

interface LandingViewProps {
  config: NavConfig;
  onNavigate: (path: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ config, onNavigate }) => {
  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col gap-12">
      {/* Hero Section */}
      <section className="text-center relative py-8 sm:py-12 bg-gradient-to-b from-indigo-50/50 via-white to-white rounded-3xl border border-indigo-100/60 p-6 sm:p-10 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-4">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          Production Developer Portal
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight max-w-4xl mx-auto">
          {config.title || 'API Documentation & Sandbox'}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {config.subtitle || 'Modern, high-performance API documentation, interactive playground, and real-time developer reference.'}
        </p>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">100+</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
              REST Operations
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">10+</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Engine Domains
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono">3.0.3</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
              OpenAPI Spec
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="text-2xl sm:text-3xl font-black text-sky-600 font-mono">99.9%</div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Uptime SLA
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
          <button
            onClick={() => onNavigate('/guide')}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Developer Guide (ReadMe Style)</span>
          </button>

          <button
            onClick={() => onNavigate('/docs')}
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm shadow-sm flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span>Swagger UI Sandbox</span>
          </button>

          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm shadow-sm flex items-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>System Health Check</span>
          </button>

          <a
            href="/docs/swagger.json"
            download="swagger.json"
            className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>OpenAPI Spec</span>
          </a>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">API Platform Domains</h2>
            <p className="text-xs text-slate-500 mt-0.5">Explore the modular micro-engines and services</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                📱
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                SMS & Campaigns
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">SMS Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              High-speed bulk & transactional SMS routing with carrier failover and GSM/Unicode segmentation.
            </p>
          </div>

          <div className="bg-white border border-slate-200 hover:border-sky-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                💬
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full border border-sky-100">
                Meta Graph
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">WhatsApp Business Cloud</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Official Meta Graph API integration with template synchronization and 2-way conversation inbox.
            </p>
          </div>

          <div className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                ✉️
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                SES & Zepto
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Email Engine & Verification</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dual-mode email delivery with Amazon SES and Zoho Zeptomail, DNS DKIM/SPF verification, and list cleaners.
            </p>
          </div>

          <div className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                💳
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                Ledger Accounting
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Double-Entry Ledger</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Strict immutable double-entry wallet accounting ensuring zero balance drift and automated webhooks.
            </p>
          </div>

          <div className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                👥
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                Audiences
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Contacts & Segmentation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dynamic contact segmentation, CSV import preview, opt-out suppression lists, and compliance tags.
            </p>
          </div>

          <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">
                🛠️
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                Governance
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">Admin & Developer APIs</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              SHA256 signed HMAC outbound webhooks, granular scoped API keys, rate limiters, and audit log pipelines.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
