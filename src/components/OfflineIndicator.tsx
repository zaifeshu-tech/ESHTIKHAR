import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 text-slate-950 px-3.5 py-2 text-xs font-bold shadow-2xl backdrop-blur-md border border-amber-300 animate-in slide-in-from-bottom duration-300"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950"></span>
      </span>
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode — All entries are saved locally & will sync when reconnected.</span>
    </div>
  );
};
