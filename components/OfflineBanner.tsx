import React from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  return (
    <div className="bg-[#9E9E9E] text-white px-4 py-2 flex items-center gap-2 text-sm">
      <WifiOff size={16} />
      <span>Offline — data will sync when connected</span>
    </div>
  );
}
