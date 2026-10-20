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
  FileSpreadsheet,
  Database,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useDatabase } from '../store/database';
import {
  exportDatabaseBackupJSON,
  exportDailyDuplicationExcel,
  exportCustomerRegisterExcel,
} from '../utils/exportFiles';

interface DownloadAppViewProps {
  onOpenNewEntry?: () => void;
}

export const DownloadAppView: React.FC<DownloadAppViewProps> = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isDesktop, isOnline, install } = usePWAInstall();
  const { db } = useDatabase();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'app' | 'data' | 'offline_guide'>('app');

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccess(true);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-950/60 via-slate-900 to-slate-900 border border-orange-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Downloadable Progressive Web App (PWA)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Download LPG Deduplication App
            </h1>
            <p className="text-sm text-slate-300">
              Install our full operational suite onto your Android phone, iPhone, Windows PC, or Mac. Operates with full offline storage and zero app store installation friction.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 shrink-0">
            {isInstalled || installSuccess ? (
              <div className="px-5 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 font-bold text-sm shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>App Installed & Ready</span>
              </div>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2.5 transition transform active:scale-98 cursor-pointer"
              >
                <Download className="w-5 h-5 animate-bounce" />
                <span>Download & Install App Now</span>
              </button>
            ) : isIOS ? (
              <div className="px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2">
                <Apple className="w-4 h-4 text-slate-300" />
                <span>iOS: Tap Safari Share &gt; &quot;Add to Home Screen&quot;</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy App Installation Link'}</span>
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{isOnline ? 'Network Online' : 'Offline Mode Active'}</span>
              <span>•</span>
              <span>100% Offline Capable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('app')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'app'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          App Installation & Device Guides
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'data'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Download Offline Data Backups
        </button>
        <button
          onClick={() => setActiveTab('offline_guide')}
          className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'offline_guide'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          PWA Architecture & Offline Specs
        </button>
      </div>

      {/* Tab 1: App Installation & Device Guides */}
      {activeTab === 'app' && (
        <div className="space-y-6">
          {/* Platform Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Android Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                {isAndroid && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    Detected Device
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900">Android Phones & Tablets</h3>
              <p className="text-xs text-slate-600">
                Installs as a standalone WebAPK. Opens in full-screen without URL bars or browser controls.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-900">Quick steps:</div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">1.</span>
                  <span>Tap <strong>&quot;Download App&quot;</strong> button or Chrome Menu (⋮).</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">2.</span>
                  <span>Select <strong>&quot;Install App&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">3.</span>
                  <span>Launch directly from your mobile application launcher.</span>
                </div>
              </div>
            </div>

            {/* Desktop / PC Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Monitor className="w-5 h-5" />
                </div>
                {isDesktop && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                    Detected Device
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900">Windows 10/11, Mac, ChromeOS</h3>
              <p className="text-xs text-slate-600">
                Installs as a native desktop application with Start Menu, Taskbar, and Dock integration.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-900">Quick steps:</div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">1.</span>
                  <span>Look at the right side of the browser URL bar in Chrome/Edge.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">2.</span>
                  <span>Click the <strong>Install icon ⊕</strong> or &quot;Download App&quot; button.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">3.</span>
                  <span>Runs in independent window with zero tab clutter.</span>
                </div>
              </div>
            </div>

            {/* iOS Safari Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Apple className="w-5 h-5" />
                </div>
                {isIOS && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold">
                    Detected Device
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900">iPhone & iPad (iOS Safari)</h3>
              <p className="text-xs text-slate-600">
                Apple WebKit home screen app with high-resolution Retina icon and smooth gesture navigation.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-900">Quick steps:</div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">1.</span>
                  <span>Tap the <strong>Share</strong> button (box with upward arrow) in Safari.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">2.</span>
                  <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px]">
                  <span className="font-bold text-orange-600">3.</span>
                  <span>Tap <strong>&quot;Add&quot;</strong> at top right to complete.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Offline Capabilities Banner */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-orange-400" />
                <h4 className="text-sm font-bold">Offline Delivery Logging Guarantee</h4>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                When delivery staff are on highway distribution routes without mobile cellular coverage, the downloaded app allows entering consumer numbers, performing instant duplicate checks against local storage, and queuing changes to sync to Google Drive.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ServiceWorker: ACTIVE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Download Offline Data Backups */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <h3 className="text-base font-bold text-slate-900">Offline File Downloads & Raw Backups</h3>
            <p className="text-xs text-slate-600">
              Download your agency&apos;s full database, registered customer records, and duplication audit logs in standard offline formats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Full Database JSON */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Complete Database (.json)</h4>
                <p className="text-xs text-slate-600">
                  Full backup containing {db.consumer_entries.length} consumer deliveries, {db.customers.length} registered customers, settings, and audit logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportDatabaseBackupJSON(db)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download JSON Backup
              </button>
            </div>

            {/* 2. Customer Register Excel */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Master Customer Register (.xlsx)</h4>
                <p className="text-xs text-slate-600">
                  Formatted spreadsheet of all {db.customers.length} consumers with consumer numbers, names, phone numbers, and addresses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportCustomerRegisterExcel(db.customers)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Excel Register
              </button>
            </div>

            {/* 3. Daily Duplication Excel */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Duplication Audit Report (.xlsx)</h4>
                <p className="text-xs text-slate-600">
                  Audit sheet listing duplicate refill entries, delivery men assignments, and date stamps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportDailyDuplicationExcel(db.consumer_entries, new Date().toISOString().slice(0, 10), {})}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Audit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: PWA Architecture & Offline Specs */}
      {activeTab === 'offline_guide' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Progressive Web App Technical Standards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  W3C Web App Manifest v2
                </div>
                <p className="text-slate-600">
                  Configured with short name (&quot;LPG Bharat&quot;), start URL (&quot;/&quot;), display (&quot;standalone&quot;), theme color (#ea580c), and background color (#0f172a).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Workbox Service Worker Auto-Update
                </div>
                <p className="text-slate-600">
                  Caches JS bundles, CSS, Google Fonts, and static SVG/PNG icons so the app loads instantly without waiting for network round-trips.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Compliant PNG & Maskable Icons
                </div>
                <p className="text-slate-600">
                  Includes 192x192, 512x512, 180x180 Apple Touch, and 512x512 maskable icons with safe-zone margin for Android squircle cropping.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Hybrid Local & Cloud Persistence
                </div>
                <p className="text-slate-600">
                  Data persists locally in IndexedDB and LocalStorage, while automatically syncing to the designated Google Drive account (zaifeshu@gmail.com).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
