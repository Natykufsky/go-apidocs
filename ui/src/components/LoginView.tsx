import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  Building2,
  Mail,
  KeyRound,
  CheckCircle2,
  Zap,
  Globe,
  Check,
  Copy,
} from 'lucide-react';
import { NavConfig } from './Navbar';

interface LoginViewProps {
  config: NavConfig;
  initialMode?: 'login' | 'register';
  onNavigate?: (path: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ config, initialMode = 'login', onNavigate }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Registration State
  const [orgName, setOrgName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [registeredResult, setRegisteredResult] = useState<{
    apiKey: string;
    subdomain: string;
    name: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTarget = urlParams.get('redirect') || '/docs';

      const response = await fetch('/docs/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        window.location.href = redirectTarget;
      } else {
        setErrorMessage(data.message || 'Invalid username or password. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage('Network error communicating with authentication gateway.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !subdomain.trim() || !adminEmail.trim()) {
      setErrorMessage('Please provide organization name, subdomain, and administrator email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/saas/tenants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: orgName.trim(),
          subdomain: subdomain.trim().toLowerCase(),
          admin_email: adminEmail.trim(),
          plan: selectedPlan,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.tenant) {
        setRegisteredResult({
          apiKey: data.tenant.api_key || '',
          subdomain: data.tenant.subdomain || subdomain,
          name: data.tenant.name || orgName,
        });
        // Save tenant header to local storage for quick access
        try {
          if (data.tenant.id) localStorage.setItem('apidocs_tenant_id', data.tenant.id);
          if (data.tenant.api_key) localStorage.setItem('apidocs_access_token', data.tenant.api_key);
        } catch (e) {}
        setLoading(false);
      } else {
        setErrorMessage(data.error || data.message || 'Failed to register organization workspace.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage('Network error provisioning SaaS tenant workspace.');
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (registeredResult?.apiKey) {
      navigator.clipboard.writeText(registeredResult.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex items-center justify-center p-4 sm:p-6 text-slate-900 dark:text-slate-100 font-sans selection:bg-slate-900 selection:text-white">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <a
            href="/"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate('/');
              }
            }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-white text-2xl shadow-md mb-3 text-white dark:text-slate-950 font-bold hover:scale-105 transition-transform cursor-pointer"
          >
            {config.icon || '⚡'}
          </a>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            {config.title || 'API Docs Cloud Platform'}
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Enterprise Developer Gateway & Multi-Tenant QA Suite
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          
          {/* Segmented Mode Switcher */}
          {!registeredResult && (
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[38px] ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[38px] ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Create Workspace
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && !registeredResult && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="username">
                  Developer / Admin ID
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or developer email"
                    required
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-slate-900 font-medium min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="password">
                  Password / Token
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-11 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-slate-900 font-medium min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-slate-950 font-bold py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs transition-all cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Platform & Sandbox</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* OAuth Single Sign-On Options */}
              <div className="pt-3 space-y-3">
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                  <span className="bg-white dark:bg-[#0d121f] px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute">
                    Or Continue With
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/docs/oauth/github';
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer min-h-[40px]"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    <span>GitHub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/docs/oauth/google';
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer min-h-[40px]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z" />
                      <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.9 7.5 23.5 12 23.5z" />
                    </svg>
                    <span>Google</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODE 2: TENANT REGISTRATION */}
          {mode === 'register' && !registeredResult && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="orgName">
                  Organization Name
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    id="orgName"
                    type="text"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      if (!subdomain) {
                        setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    placeholder="Acme Payments Inc."
                    required
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-slate-900 font-medium min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="subdomain">
                  Workspace Subdomain
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    id="subdomain"
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="acme"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-24 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-slate-900 font-mono min-h-[44px]"
                  />
                  <div className="absolute right-3 text-[11px] font-mono text-slate-400 pointer-events-none">
                    .apidocs.dev
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="adminEmail">
                  Administrator Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="lead-architect@acme.com"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-slate-900 font-medium min-h-[44px]"
                  />
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subscription Tier
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['free', 'pro', 'enterprise'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPlan(p)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold capitalize transition-all border cursor-pointer min-h-[40px] ${
                        selectedPlan === p
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-slate-950 font-bold py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs transition-all cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Provisioning organization...</span>
                  </>
                ) : (
                  <>
                    <span>Create Organization & API Key</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTRATION SUCCESS RESULT CARD */}
          {registeredResult && (
            <div className="space-y-5 text-center py-2 animate-in fade-in-50 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-950 dark:text-white">
                  Workspace Provisioned Successfully
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tenant <span className="font-bold text-slate-900 dark:text-white">{registeredResult.name}</span> ({registeredResult.subdomain}.apidocs.dev) is active.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    Generated Tenant API Key
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-900 dark:text-white break-all font-semibold select-all">
                  {registeredResult.apiKey}
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <a
                  href="/docs"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer min-h-[44px]"
                >
                  <Zap className="w-4 h-4 fill-current text-emerald-400 dark:text-emerald-600" />
                  <span>Launch Workspace Documentation</span>
                </a>
              </div>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>HMAC-SHA256 Encrypted</span>
            </span>
            <a
              href="/"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('/');
                }
              }}
              className="text-slate-700 dark:text-slate-300 hover:underline font-semibold"
            >
              Back to Overview &rarr;
            </a>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} {config.title} &bull; Protected Developer Gateway
        </p>
      </div>
    </div>
  );
};
