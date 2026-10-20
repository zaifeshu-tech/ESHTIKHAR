import React, { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowRight, Flame, CheckCircle2 } from 'lucide-react';
import { formatIST } from '../utils/deduplication';

interface LoginViewProps {
  agencyName: string;
  agencyCode: string;
  onLogin: (username: string, password: string) => { ok: boolean; error?: string };
}

export const LoginView: React.FC<LoginViewProps> = ({ agencyName, agencyCode, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Please enter both username and password.');
      return;
    }
    const result = onLogin(cleanUser, password);
    if (!result.ok) {
      setError(result.error || 'Invalid credentials.');
    }
  };

  const handleQuickDemoLogin = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
    onLogin(demoUser, demoPass);
  };

  const currentIST = formatIST();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-10">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            LPG Deduplication Checklist
          </span>
        </div>
        <div className="text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
          IST: {currentIST.timestampIST}
        </div>
      </header>

      {/* Main Split Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Agency Operational Overview */}
        <div className="lg:col-span-6 space-y-5">
          <div className="text-xs font-medium text-slate-500">
            {agencyName} · Distributor Code {agencyCode} · Asia/Kolkata (IST)
          </div>
          <h1
            className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Fast Consumer Number Entry & Real-Time Duplicate Control
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Built for daily LPG agency counter and godown operations. Record Consumer Numbers against Delivery Men with
            automatic Indian Standard Time (IST) timestamps and instant Same-Day, 30-Day, and Monthly duplicate
            verification.
          </p>

          <div className="pt-2 space-y-3 border-t border-slate-200 text-sm text-slate-700">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Click Focus Workflow:</strong> Consumer Number field focuses automatically on entry and
                immediately after every save.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Sticky Delivery Man Memory:</strong> Select Delivery Man once (e.g., Raksharam) and log
                hundreds of consumers continuously.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Exact Text Preservation:</strong> Leading zeros (e.g., <code className="font-mono">0012345678</code>)
                are preserved across checks and Excel/CSV/PDF exports.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-md mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Sign In to Agency Portal</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your Admin or Staff username and password to continue.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username (e.g. eshtikhar or ravi)"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full min-h-[46px] pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Role Access for Fast Evaluation & Testing */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  Admin & Staff Accounts
                </span>
                <span className="text-xs text-slate-400">One-tap sign in</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('eshtikhar', 'eshtikhar123')}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Admin (Eshtikhar)</div>
                  <div className="text-[11px] text-slate-500 font-mono">eshtikhar / eshtikhar123</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ravi', 'staff123')}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Staff (Ravi)</div>
                  <div className="text-[11px] text-slate-500 font-mono">ravi / staff123</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('priya', 'staff123')}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Staff (Priya)</div>
                  <div className="text-[11px] text-slate-500 font-mono">priya / staff123</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>LPG Consumer Deduplication Checklist · Operational Portal</span>
        <span>Timezone locked to India Standard Time (Asia/Kolkata)</span>
      </footer>
    </div>
  );
};
