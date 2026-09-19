import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { NavConfig } from './Navbar';

interface LoginViewProps {
  config: NavConfig;
}

export const LoginView: React.FC<LoginViewProps> = ({ config }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-3xl shadow-xl shadow-indigo-500/25 mb-4 ring-8 ring-indigo-500/10">
            {config.icon || '⚡'}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            {config.title || 'API Documentation'}
          </h1>
          <p className="text-sm font-medium text-slate-400">
            {config.subtitle || 'Developer Reference & Swagger QA Portal'}
          </p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Protected Developer Access
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2" htmlFor="username">
                Developer Username
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
                  placeholder="admin or developer ID"
                  required
                  autoFocus
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2" htmlFor="password">
                Access Password
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
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 pl-10 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-[0.99] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Unlock Documentation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">
              Session is secured with encrypted HTTP-only JWT token.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; {new Date().getFullYear()} {config.title} &bull; Protected Gateway
        </p>
      </div>
    </div>
  );
};
