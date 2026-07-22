import React, { useState, useEffect } from 'react';
import { Database, Download, X, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

interface BackupPromptBannerProps {
  onExportBackup: () => void;
  lastBackupDate: string | null;
}

export default function BackupPromptBanner({ onExportBackup, lastBackupDate }: BackupPromptBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeAgoText, setTimeAgoText] = useState<string>('Never');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  useEffect(() => {
    if (!lastBackupDate) {
      setIsOverdue(true);
      setTimeAgoText('Never backed up');
      return;
    }

    const backupTime = new Date(lastBackupDate).getTime();
    if (isNaN(backupTime)) {
      setIsOverdue(true);
      setTimeAgoText('Never backed up');
      return;
    }

    const now = Date.now();
    const diffMs = now - backupTime;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (diffMs > ONE_DAY_MS) {
      setIsOverdue(true);
      const days = Math.floor(diffMs / ONE_DAY_MS);
      const hours = Math.floor((diffMs % ONE_DAY_MS) / (60 * 60 * 1000));
      if (days === 1) {
        setTimeAgoText(`1 day ago (${new Date(lastBackupDate).toLocaleDateString()})`);
      } else {
        setTimeAgoText(`${days} days ago (${new Date(lastBackupDate).toLocaleDateString()})`);
      }
    } else {
      setIsOverdue(false);
      const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
      setTimeAgoText(`Less than a day ago (${hours}h ago)`);
    }
  }, [lastBackupDate]);

  if (dismissed || !isOverdue) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-300/80 rounded-xl p-3.5 sm:p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-amber-500 text-white rounded-lg shrink-0 shadow-xs mt-0.5 sm:mt-0">
          <AlertTriangle className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-amber-950 tracking-tight">
              Back up your data
            </h3>
            <span className="inline-flex items-center gap-1 bg-amber-200/80 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              {timeAgoText}
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed max-w-2xl">
            Your database backup is more than 1 day old. Download a local copy now to protect your project budgets, worker attendance, and material logs.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          onClick={onExportBackup}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Back Up Now</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-2 text-amber-800/70 hover:text-amber-950 hover:bg-amber-200/50 rounded-lg transition cursor-pointer"
          title="Dismiss for this session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
