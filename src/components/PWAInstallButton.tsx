import React from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenModal: () => void;
  className?: string;
  variant?: 'header' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenModal,
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        onOpenModal();
      }
    } else {
      onOpenModal();
    }
  };

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
          isInstalled
            ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800/40'
            : 'bg-gradient-to-r from-orange-600/20 to-amber-600/20 text-orange-300 hover:text-white hover:from-orange-600/30 hover:to-amber-600/30 border border-orange-500/30'
        } ${className}`}
        title="Download / Install LPG App for Offline Use"
      >
        <span className="flex items-center gap-2">
          {isInstalled ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Download className="w-4 h-4 text-orange-400 animate-bounce" />
          )}
          <span>{isInstalled ? 'App Installed (Offline)' : 'Download / Install App'}</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 font-mono">
          PWA
        </span>
      </button>
    );
  }

  // Header variant
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer ${
        isInstalled
          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
          : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/20'
      } ${className}`}
      title="Download & Install App (PWA + Offline)"
    >
      {isInstalled ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Installed</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5" />
          <span>Download App</span>
        </>
      )}
    </button>
  );
};
