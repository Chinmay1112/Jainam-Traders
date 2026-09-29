'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getCurrentNetworkStatus, subscribeNetworkStatus } from '@/lib/native/capacitor-bridge';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    getCurrentNetworkStatus().then(setIsOnline);
    const unsubscribe = subscribeNetworkStatus(setIsOnline);
    return () => unsubscribe();
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between sticky top-0 z-50 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
        <span>
          You are offline. Browsing cached store items. Real pickup reservations require an internet connection.
        </span>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}
