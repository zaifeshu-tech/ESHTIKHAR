import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Apple,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
  FileSpreadsheet,
  Database,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useDatabase } from '../store/database';
import {
  exportDatabaseBackupJSON,
  exportDailyDuplicationExcel,
  exportCustomerRegisterExcel,
} from '../utils/exportFiles';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isDesktop, isOnline, install } = usePWAInstall();
  const { db } = useDatabase();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'data' | 'guide'>('app');

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccess(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Download className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 id="download-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
                Download & Install LPG App
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  PWA + Offline
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Install as a standalone app on your Mobile, Tablet, or PC with full offline support.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close download modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-5 pt-2 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('app')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'app'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Install Standalone App
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'data'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Download Offline Data
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'guide'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Install Instructions
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'app' && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-600/30">
                    LPG
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">BharatGas LPG Deduplication System</h3>
                    <p className="text-xs text-slate-400">Version 1.2.0 • Standalone Progressive Web App</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium">
                  {isOnline ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Wifi className="w-3.5 h-3.5" /> Online Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <WifiOff className="w-3.5 h-3.5" /> Offline Mode Active
                    </span>
                  )}
                  {isInstalled ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Installed
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Main Action based on install state */}
              {isInstalled || installSuccess ? (
                <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-white">App is Installed & Ready!</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    You are running the standalone LPG Deduplication application. It is stored directly on your device, works completely offline, and automatically syncs changes to Google Drive when connected.
                  </p>
                </div>
              ) : isInstallable ? (
                <div className="p-5 rounded-xl bg-gradient-to-br from-orange-950/40 to-slate-800 border border-orange-500/30 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-orange-400" />
                        1-Click Native Installation
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Download and install the app onto your home screen or desktop application drawer with zero app store hassle.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-xl shadow-orange-600/25 flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    Download & Install App Now
                  </button>
                  <p className="text-[11px] text-center text-slate-400">
                    Works offline • Fast loading • Zero installation permissions required
                  </p>
                </div>
              ) : isIOS ? (
                <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Apple className="w-5 h-5 text-slate-300" />
                    Install on iPhone / iPad (iOS Safari)
                  </div>
                  <p className="text-xs text-slate-300">
                    Apple iOS requires adding web apps via Safari toolbar:
                  </p>
                  <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pl-2">
                    <li>Tap the <strong>Share</strong> button <span className="text-orange-400">⎋</span> in Safari toolbar at bottom.</li>
                    <li>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong> ⊞.</li>
                    <li>Tap <strong>&quot;Add&quot;</strong> in top-right corner.</li>
                  </ol>
                  <div className="p-3 bg-slate-900 rounded-lg text-[11px] text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    The LPG icon will be saved to your home screen and open in full-screen standalone mode.
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Monitor className="w-5 h-5 text-slate-300" />
                    Install via Browser Menu
                  </div>
                  <p className="text-xs text-slate-300">
                    You can install this app directly in Google Chrome, Microsoft Edge, or Android:
                  </p>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li><strong>Chrome / Edge (PC/Mac):</strong> Click the <strong>Install icon 📥</strong> on the right side of the URL address bar, or click Menu (⋮) → &quot;Save and Share&quot; → &quot;Install LPG App&quot;.</li>
                    <li><strong>Android:</strong> Tap the browser menu (⋮) → &quot;Install App&quot; or &quot;Add to Home screen&quot;.</li>
                  </ul>
                </div>
              )}

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <h5 className="text-xs font-bold text-white">Full Offline Cache</h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Operate delivery logs without internet. All changes sync when online.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h5 className="text-xs font-bold text-white">Device Isolation</h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Runs in isolated sandbox without browser toolbars or distractions.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                    <Database className="w-4 h-4" />
                  </div>
                  <h5 className="text-xs font-bold text-white">Instant Startup</h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Preloaded assets launch immediately from device flash storage.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                <h4 className="text-sm font-bold text-white mb-1">Download Offline Data Backup</h4>
                <p className="text-xs text-slate-400">
                  Export complete records, customer registers, and duplication audit logs in standard offline formats (JSON and Excel).
                </p>
              </div>

              <div className="space-y-2.5">
                {/* 1. Complete Database JSON */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-orange-500/20 text-orange-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Complete System Database (.json)</div>
                      <div className="text-[11px] text-slate-400">
                        {db.entries.length} delivery entries • {db.customers.length} registered customers • {db.users.length} staff
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => exportDatabaseBackupJSON(db)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>

                {/* 2. Customer Register Excel */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Master Customer Register (.xlsx)</div>
                      <div className="text-[11px] text-slate-400">
                        Spreadsheet with names, addresses, SV numbers, and phone records
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => exportCustomerRegisterExcel(db.customers)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Excel
                  </button>
                </div>

                {/* 3. Duplication Audit Report */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Daily & 30-Day Duplicate Report (.xlsx)</div>
                      <div className="text-[11px] text-slate-400">
                        Audit sheet of repeat consumer bookings and delivery staff logs
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => exportDailyDuplicationExcel(db.entries, new Date().toISOString().slice(0, 10), {})}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Excel
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-orange-400" />
                  Desktop (Windows 10/11, macOS, Linux, ChromeOS)
                </h4>
                <ol className="text-xs text-slate-300 mt-2 space-y-1.5 list-decimal list-inside">
                  <li>Open this app in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.</li>
                  <li>Look at the top URL address bar on the right side.</li>
                  <li>Click the <strong>&quot;Install LPG App&quot; icon ⊕</strong>.</li>
                  <li>Click <strong>Install</strong>. A desktop shortcut and Start Menu icon will be created automatically.</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Android Smartphones & Tablets
                </h4>
                <ol className="text-xs text-slate-300 mt-2 space-y-1.5 list-decimal list-inside">
                  <li>Open the app in Chrome for Android.</li>
                  <li>Tap the <strong>&quot;Download App&quot;</strong> button or browser Menu (⋮).</li>
                  <li>Tap <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</li>
                  <li>The app will install like a native Android APK with its own app drawer icon and splash screen.</li>
                </ol>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Apple className="w-4 h-4 text-slate-300" />
                  Apple iPhone & iPad
                </h4>
                <ol className="text-xs text-slate-300 mt-2 space-y-1.5 list-decimal list-inside">
                  <li>Open the app in <strong>Safari</strong> on iOS.</li>
                  <li>Tap the <strong>Share</strong> icon (square with arrow pointing up).</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Compliant PWA Standard • Works completely offline
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
